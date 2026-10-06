import { db } from "./env";
import { CONNECTORS, INGEST_CITIES } from "./connectors";
import { notify } from "./notify";
import { Store, type UpsertResult } from "./store";
import type { NormalizedEvent } from "./types";

// Usage : npm run ingest -- [--city=paris] [--source=paris-opendata] [--dry-run] [--no-notify]
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }),
) as Record<string, string | true>;

async function pool<T>(items: T[], size: number, fn: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (i < items.length) await fn(items[i++]);
    }),
  );
}

async function main() {
  const dry = !!args["dry-run"];
  const cities = INGEST_CITIES.filter((c) => !args.city || c.slug === args.city);
  const connectors = CONNECTORS.filter((c) => !args.source || c.id === args.source);
  const store = dry ? null : new Store(db());
  let failures = 0;

  for (const city of cities) {
    for (const conn of connectors) {
      const log = (m: string) => console.log(`[${city.slug}/${conn.id}] ${m}`);
      const runStart = new Date().toISOString();
      let events: NormalizedEvent[] | null;
      try {
        events = await conn.fetch(city, log);
      } catch (e) {
        failures++;
        log(`ÉCHEC de la collecte : ${(e as Error).message}`);
        continue;
      }
      if (!events) continue;

      // Doublons internes à une même source (même id renvoyé deux fois).
      events = [...new Map(events.map((e) => [e.sourceId, e])).values()];

      if (dry || !store) {
        const byCat: Record<string, number> = {};
        for (const e of events) for (const c of e.categories) byCat[c] = (byCat[c] ?? 0) + 1;
        log(`dry-run : ${events.length} événements normalisés — ${JSON.stringify(byCat)}`);
        for (const e of events.slice(0, 3)) log(`  ex. ${e.title} | ${e.startAt} → ${e.endAt} | allDay=${e.allDay} | ${e.venueName} | ${e.priceMin ?? "?"}€ | ${e.ticketUrl ?? e.officialUrl}`);
        continue;
      }

      const known = await store.preload(conn.id);
      const counts: Record<UpsertResult | "error", number> = { new: 0, updated: 0, merged: 0, error: 0 };
      await pool(events, 8, async (e) => {
        try {
          counts[await store.upsert(e)]++;
        } catch (err) {
          counts.error++;
          if (counts.error <= 5) log(`erreur sur « ${e.title} » : ${(err as Error).message}`);
        }
      });
      log(`nouveaux=${counts.new} mis à jour=${counts.updated} fusionnés (doublons)=${counts.merged} erreurs=${counts.error}`);

      // On ne retire des événements que si la collecte semble complète.
      if (counts.error === 0 && events.length >= known * 0.5) {
        const retired = await store.retireMissing(conn.id, runStart);
        if (retired) log(`${retired} événements disparus de la source masqués`);
      }
    }
  }

  if (store) {
    await store.purgeOld();
    if (!args["no-notify"]) await notify("now");
  }
  if (failures) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
