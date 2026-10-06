import { db } from "./env";
import { CONNECTORS, PLACE_CONNECTORS, PLACES_REFRESH_DAYS } from "./connectors";
import { notify } from "./notify";
import { Store, type UpsertResult } from "./store";
import type { CityConfig, Connector, NormalizedEvent } from "./types";

// Usage : npm run ingest -- [--area=cotonou-bj] [--source=osm] [--places] [--dry-run] [--no-notify]
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }),
) as Record<string, string | true>;

const ACTIVE_DAYS = 30;

async function pool<T>(items: T[], size: number, fn: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (i < items.length) await fn(items[i++]);
    }),
  );
}

interface AreaRow {
  slug: string;
  name: string;
  country: string;
  timezone: string;
  currency: string;
  radius_km: number;
  status: string;
  last_requested_at: string;
  places_ingested_at: string | null;
}

/** Zones à collecter : demandées récemment, en préparation, ou suivies par une alerte. */
async function loadAreas(sb: ReturnType<typeof db>): Promise<(CityConfig & { row: AreaRow })[]> {
  const { data, error } = await sb
    .from("cities")
    .select("slug, name, country, timezone, currency, radius_km, status, last_requested_at, places_ingested_at")
    .eq("active", true);
  if (error) throw error;
  const { data: subs } = await sb.from("push_subscriptions").select("city");
  const followed = new Set((subs ?? []).map((s) => s.city as string));
  const since = new Date(Date.now() - ACTIVE_DAYS * 86400e3).toISOString();

  const rows = (data as AreaRow[]).filter((r) =>
    args.area ? r.slug === args.area : r.status === "pending" || r.last_requested_at >= since || followed.has(r.slug),
  );
  return Promise.all(
    rows.map(async (row) => {
      const { data: c } = await sb.rpc("city_coords", { p_slug: row.slug });
      const { lat, lng } = (c as { lat: number; lng: number }[])[0];
      return { slug: row.slug, name: row.name, country: row.country, timezone: row.timezone, currency: row.currency, lat, lng, radiusKm: Number(row.radius_km), row };
    }),
  );
}

async function runConnector(store: Store | null, city: CityConfig, conn: Connector): Promise<"failed" | "partial" | "complete"> {
  const log = (m: string) => console.log(`[${city.slug}/${conn.id}] ${m}`);
  const runStart = new Date().toISOString();
  let events: NormalizedEvent[] | null;
  try {
    events = await conn.fetch(city, log);
  } catch (e) {
    log(`ÉCHEC de la collecte : ${(e as Error).message}`);
    return "failed";
  }
  if (!events) return "complete";
  events = [...new Map(events.map((e) => [e.sourceId, e])).values()];

  if (!store) {
    const byCat: Record<string, number> = {};
    for (const e of events) for (const c of e.categories) byCat[c] = (byCat[c] ?? 0) + 1;
    log(`dry-run : ${events.length} normalisés — ${JSON.stringify(byCat)}`);
    for (const e of events.slice(0, 5)) log(`  ex. ${e.title} | ${e.kind} | ${e.hoursText ?? e.startAt} | ${e.address ?? ""} | ${e.officialUrl}`);
    return "complete";
  }

  await store.preload(conn.id);
  const known = await store.knownCount(conn.id, city.slug);
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

  // Collecte jugée complète si elle ramène au moins la moitié de ce qu'on connaissait déjà.
  const complete = counts.error === 0 && events.length >= known * 0.5;
  if (complete) {
    const retired = await store.retireMissing(conn.id, city.slug, runStart);
    if (retired) log(`${retired} disparus de la source masqués`);
  } else if (counts.error === 0) {
    log(`collecte partielle (${events.length} contre ${known} connus) : rien n'est retiré, nouvel essai au prochain passage`);
  }
  return complete ? "complete" : "partial";
}

async function main() {
  const sb = db();
  const store = args["dry-run"] ? null : new Store(sb);
  const areas = await loadAreas(sb);
  console.log(`${areas.length} zone(s) : ${areas.map((a) => a.slug).join(", ")}`);
  let failures = 0;

  for (const area of areas) {
    for (const conn of CONNECTORS.filter((c) => !args.source || c.id === args.source)) {
      if ((await runConnector(store, area, conn)) === "failed") failures++;
    }

    const placesDue =
      !!args.places ||
      args.source === "osm" ||
      !area.row.places_ingested_at ||
      Date.now() - new Date(area.row.places_ingested_at).getTime() > PLACES_REFRESH_DAYS * 86400e3;
    let placesOk = false;
    if (placesDue) {
      placesOk = true;
      for (const conn of PLACE_CONNECTORS.filter((c) => !args.source || c.id === args.source)) {
        const r = await runConnector(store, area, conn);
        if (r === "failed") failures++;
        if (r !== "complete") placesOk = false;
      }
    }

    if (store) {
      const now = new Date().toISOString();
      // Première collecte des lieux ratée : la zone reste « en préparation » et sera retentée au prochain passage.
      const firstPlacesFailed = placesDue && !placesOk && !area.row.places_ingested_at;
      await sb
        .from("cities")
        .update({
          last_ingested_at: now,
          ...(firstPlacesFailed ? {} : { status: "ready" }),
          ...(placesDue && placesOk ? { places_ingested_at: now } : {}),
        })
        .eq("slug", area.slug);
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
