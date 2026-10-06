import webpush from "web-push";
import { db } from "./env";
import { fmtRange, todayIn } from "../lib/dates";

type Frequency = "now" | "daily";

function body(n: number, city: string, from: string, to: string): string {
  const what = n > 1 ? `${n} nouveaux événements` : "1 nouvel événement";
  return `${what} à ${city} pendant ton séjour (${fmtRange(from, to, "fr-FR")})`;
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
    if (s.date_to < todayIn(city.timezone)) {
      await sb.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      removed++;
      continue;
    }
    const startedAt = new Date().toISOString();
    const { data: n, error: e } = await sb.rpc("count_new_for_subscription", { p_endpoint: s.endpoint, p_since: s.last_notified_at });
    if (e) throw e;
    if (!n) continue;

    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: s.keys },
        JSON.stringify({ title: "Artwhere", body: body(n as number, city.name, s.date_from, s.date_to), url: "/" }),
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
