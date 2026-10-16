import webpush from "web-push";
import { db } from "./env";
import { fmtRange, todayIn } from "../lib/dates";

type Frequency = "now" | "daily";

function body(n: number, city: string, from: string, to: string): string {
  const what = n > 1 ? `${n} nouveaux événements` : "1 nouvel événement";
  return `${what} à ${city} pendant ton séjour (${fmtRange(from, to, "fr-FR")})`;
}

type VenueNew = { city: string; venue_name: string | null; title: string };

// Lieux suivis : un seul nouvel événement → lieu et titre ; plusieurs → total.
function venueBody(rows: VenueNew[]): string {
  if (rows.length === 1) return `${rows[0].venue_name ?? "Un lieu que tu suis"} a publié un nouvel événement : ${rows[0].title}`;
  return `${rows.length} nouveaux événements dans tes lieux suivis`;
}

export async function notify(frequency: Frequency): Promise<void> {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    console.log("[notify] clés VAPID absentes : pas d'envoi");
    return;
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:contact@artwhere.app", pub, priv);
  const sb = db();

  const { data: subs, error } = await sb.from("push_subscriptions").select("*").eq("frequency", frequency);
  if (error) throw error;
  const { data: cities, error: cErr } = await sb.from("cities").select("slug, name, timezone");
  if (cErr) throw cErr;
  const bySlug = new Map((cities as { slug: string; name: string; timezone: string }[]).map((c) => [c.slug, c]));

  let sent = 0;
  let removed = 0;
  for (const s of subs) {
    const city = bySlug.get(s.city);
    if (!city) continue;
    // Colonne `venues` : migration 0007 (absente avant, d'où le repli).
    const venues: string[] = s.venues ?? [];
    // Séjour terminé : l'alerte de recherche s'arrête, mais l'abonnement reste s'il suit des lieux.
    const expired = s.date_to < todayIn(city.timezone);
    if (expired && !venues.length) {
      await sb.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      removed++;
      continue;
    }
    const startedAt = new Date().toISOString();
    let venueNew: VenueNew[] = [];
    if (venues.length) {
      const { data, error: ve } = await sb.rpc("new_venue_events", { p_keys: venues, p_since: s.last_notified_at });
      if (ve) throw ve;
      venueNew = (data as VenueNew[] | null) ?? [];
    }
    let n = 0;
    if (!expired) {
      const { data, error: e } = await sb.rpc("count_new_for_subscription", { p_endpoint: s.endpoint, p_since: s.last_notified_at });
      if (e) throw e;
      n = (data as number | null) ?? 0;
    }
    if (!n && !venueNew.length) continue;
    const text = venueNew.length ? venueBody(venueNew) : body(n, city.name, s.date_from, s.date_to);

    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: s.keys },
        JSON.stringify({ title: "Artwhere", body: text, url: "/" }),
        { TTL: 12 * 3600, urgency: "normal" },
      );
      sent++;
      await sb.from("push_subscriptions").update({ last_notified_at: startedAt }).eq("endpoint", s.endpoint);
    } catch (err) {
      const code = (err as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) {
        await sb.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        removed++;
      } else console.log(`[notify] échec d'envoi (${code ?? "?"})`);
    }
  }
  console.log(`[notify:${frequency}] ${sent} notifications envoyées, ${removed} abonnements retirés`);
}

// Le cron tourne à 7h et 8h UTC pour couvrir l'heure d'été/hiver : on n'envoie qu'à 9h à Paris.
const parisHour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
if (process.argv.includes("--daily") && (parisHour === 9 || process.argv.includes("--force"))) {
  notify("daily").catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
