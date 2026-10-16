import "server-only";
import tzLookup from "@photostructure/tz-lookup";
import countryToCurrency from "country-to-currency";
import type { Area, Place } from "./area";
import { supabaseAdmin } from "./supabase";

const DEFAULT_RADIUS_KM = 25;

type Row = {
  slug: string;
  name: string;
  country: string;
  timezone: string;
  currency: string;
  status: Area["status"];
  last_ingested_at: string | null;
};

async function withCoords({ last_ingested_at, ...r }: Row): Promise<Area> {
  const { data } = await supabaseAdmin().rpc("city_coords", { p_slug: r.slug });
  const c = (data as { lat: number; lng: number }[] | null)?.[0];
  return { ...r, lat: c?.lat ?? 0, lng: c?.lng ?? 0, lastIngestedAt: last_ingested_at };
}

export async function getArea(slug: string): Promise<Area | null> {
  const { data, error } = await supabaseAdmin()
    .from("cities")
    .select("slug, name, country, timezone, currency, status, last_ingested_at")
    .eq("slug", slug)
    .maybeSingle<Row>();
  if (error) throw error;
  return data ? withCoords(data) : null;
}

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

/** Zone existante qui couvre ce point, sinon création (statut pending) et lancement de la collecte. */
export async function resolveArea(p: Place): Promise<Area> {
  const sb = supabaseAdmin();
  const { data: near, error } = await sb.rpc("nearest_city", { p_lat: p.lat, p_lng: p.lng });
  if (error) throw error;
  if (near) {
    await sb.from("cities").update({ last_requested_at: new Date().toISOString() }).eq("slug", near);
    return (await getArea(near as string))!;
  }

  const base = `${slugify(p.name)}-${p.countryCode.toLowerCase()}`;
  let slug = base;
  for (let i = 2; await getArea(slug); i++) slug = `${base}-${i}`;

  const row = {
    slug,
    name: p.name,
    country: p.countryCode.toUpperCase(),
    timezone: tzLookup(p.lat, p.lng),
    currency: (countryToCurrency as Record<string, string>)[p.countryCode.toUpperCase()] ?? "USD",
    center: `SRID=4326;POINT(${p.lng} ${p.lat})`,
    radius_km: DEFAULT_RADIUS_KM,
    active: true,
    status: "pending",
  };
  const { error: insErr } = await sb.from("cities").insert(row);
  if (insErr) throw insErr;
  await dispatchIngest(slug);
  return { slug, name: row.name, country: row.country, lat: p.lat, lng: p.lng, timezone: row.timezone, currency: row.currency, status: "pending" };
}

async function dispatchIngest(slug: string): Promise<void> {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const repo = process.env.GITHUB_REPO;
  if (!token || !repo) {
    console.warn(`[areas] collecte non déclenchée pour ${slug} : GITHUB_DISPATCH_TOKEN/GITHUB_REPO absents`);
    return;
  }
  const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/ingest.yml/dispatches`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    body: JSON.stringify({ ref: "main", inputs: { task: "ingest", area: slug } }),
  });
  if (!res.ok) console.error(`[areas] échec du déclenchement (${res.status}) pour ${slug}`);
}
