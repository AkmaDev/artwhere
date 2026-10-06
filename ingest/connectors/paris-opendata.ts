import { haversineKm } from "../../lib/area";
import type { CategoryId } from "../../lib/categories";
import { zonedDayStart } from "../../lib/dates";
import { fmtDuration, fmtHourRange, isHttpUrl, looksOngoing, parsePrices, stripHtml, truncate } from "../normalize";
import type { Connector, NormalizedEvent } from "../types";

// https://opendata.paris.fr/explore/dataset/que-faire-a-paris-/ — Licence ODbL, sans clé.
const API = "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/que-faire-a-paris-/exports/json";
const FIELDS = [
  "id", "url", "title", "lead_text", "description", "date_start", "date_end", "occurrences", "date_description",
  "cover_url", "address_name", "address_street", "address_zipcode", "address_city", "lat_lon",
  "price_type", "price_detail", "access_type", "access_link", "contact_url", "qfap_tags", "updated_at", "locale",
];

interface Rec {
  id: string;
  url: string | null;
  title: string | null;
  lead_text: string | null;
  description: string | null;
  date_start: string | null;
  date_end: string | null;
  occurrences: string | null;
  date_description: string | null;
  cover_url: string | null;
  address_name: string | null;
  address_street: string | null;
  address_zipcode: string | null;
  address_city: string | null;
  lat_lon: { lat: number; lon: number } | null;
  price_type: string | null;
  price_detail: string | null;
  access_type: string | null;
  access_link: string | null;
  contact_url: string | null;
  qfap_tags: string | null;
  locale: string | null;
}

const TAGS: Record<string, CategoryId> = {
  Expo: "expo",
  "Art contemporain": "expo",
  Photo: "expo",
  Peinture: "expo",
  Concert: "concert",
  "Spectacle musical": "concert",
  Théâtre: "theatre",
  Humour: "theatre",
  Danse: "danse",
  Ecrans: "cinema",
  Festival: "festival",
  "Balade urbaine": "visite",
  Atelier: "atelier",
};

export function categoriesFor(tags: string[], venue: string | null): CategoryId[] {
  // Vie nocturne (clubs) : hors périmètre V1.
  if (tags.includes("Nuit")) return [];
  const out = new Set<CategoryId>();
  for (const t of tags) if (TAGS[t]) out.add(TAGS[t]);
  if (tags.includes("Histoire") && !tags.includes("Conférence")) out.add("patrimoine");
  if (venue && /\bmus[ée]e\b/i.test(venue) && (out.has("expo") || out.size === 0)) out.add("musee");
  // Ateliers et balades « sport / santé / solidarité » (yoga, vélo, emploi…) : hors positionnement culturel.
  if (tags.some((t) => t === "Sport" || t === "Santé" || t === "Solidarité")) {
    out.delete("atelier");
    out.delete("visite");
  }
  return [...out];
}

function parseOccurrences(s: string | null): [string, string][] {
  if (!s) return [];
  return s
    .split(";")
    .map((p) => p.split("_"))
    .filter((p) => p.length === 2 && !Number.isNaN(Date.parse(p[0])) && !Number.isNaN(Date.parse(p[1])))
    .map(([a, b]) => {
      const start = new Date(a).getTime();
      let end = new Date(b).getTime();
      // Séance qui finit après minuit, saisie avec la date du début.
      if (end < start && start - end < 24 * 3600e3) end += 24 * 3600e3;
      return [new Date(start).toISOString(), new Date(Math.max(end, start)).toISOString()] as [string, string];
    })
    .sort((x, y) => x[0].localeCompare(y[0]));
}

// date_start/date_end sont des heures locales étiquetées UTC à tort : on relit l'heure murale.
function wallClock(iso: string, tz: string): string {
  const day = iso.slice(0, 10);
  const [h, m, s] = iso.slice(11, 19).split(":").map(Number);
  return new Date(zonedDayStart(day, tz).getTime() + ((h * 60 + m) * 60 + s) * 1000).toISOString();
}

function hoursFrom(desc: string | null): string | null {
  const text = stripHtml(desc);
  if (!text) return null;
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines[0] && /^(du|le|les)\s/i.test(lines[0])) lines.shift();
  const s = lines.join(" ").replace(/\s+/g, " ").replace(/(\d{1,2}h\d{0,2})\s+(?=[a-zé])/gi, "$1 · ").trim();
  return s && s.length <= 160 ? s : null;
}

export const parisOpenData: Connector = {
  id: "paris-opendata",
  async fetch(city, log) {
    // Jeu de données de la Ville de Paris : seulement pour une zone centrée sur Paris.
    if (haversineKm(city.lat, city.lng, 48.8566, 2.3522) > 15) return null;
    const params = new URLSearchParams({ select: FIELDS.join(","), where: "date_end >= now(days=-1)", timezone: "UTC" });
    const res = await fetch(`${API}?${params}`, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`paris-opendata HTTP ${res.status}`);
    const recs = (await res.json()) as Rec[];
    log(`${recs.length} enregistrements bruts`);

    const out: NormalizedEvent[] = [];
    let skipped = 0;
    for (const r of recs) {
      const tags = (r.qfap_tags ?? "").split(";").map((t) => t.trim()).filter(Boolean);
      const categories = categoriesFor(tags, r.address_name);
      if (!r.title || !categories.length || !r.lat_lon || !isHttpUrl(r.url)) {
        skipped++;
        continue;
      }
      const occ = parseOccurrences(r.occurrences).slice(0, 400);
      let startAt: string;
      let endAt: string;
      if (occ.length) {
        startAt = occ[0][0];
        endAt = occ.reduce((mx, o) => (o[1] > mx ? o[1] : mx), occ[0][1]);
      } else if (r.date_start && r.date_end) {
        startAt = wallClock(r.date_start, city.timezone);
        endAt = wallClock(r.date_end, city.timezone);
        if (endAt < startAt) endAt = startAt;
      } else {
        skipped++;
        continue;
      }

      const base = { startAt, endAt, occurrences: occ };
      const allDay = looksOngoing(base);
      const free = r.price_type === "gratuit" || r.price_type === "gratuit sous condition";
      const prices = free ? { min: 0, max: 0 } : parsePrices(stripHtml(r.price_detail));
      const lowerTitle = r.title.toLowerCase();
      const status = /\bannul[ée]/.test(lowerTitle) ? "cancelled" : /\bcomplet\b/.test(lowerTitle) ? "full" : "available";
      const single = !allDay && occ.length <= 1;
      const address = [r.address_street, [r.address_zipcode, r.address_city].filter(Boolean).join(" ")].filter(Boolean).join(", ");

      out.push({
        source: "paris-opendata",
        kind: "event",
        sourceId: String(r.id),
        sourceUrl: r.url,
        raw: r,
        title: r.title.trim(),
        description: truncate(stripHtml(r.lead_text) ?? stripHtml(r.description)),
        imageUrl: isHttpUrl(r.cover_url) ? r.cover_url : null,
        categories,
        occurrences: allDay ? [] : occ,
        startAt,
        endAt,
        allDay,
        hoursText: hoursFrom(r.date_description) ?? (single ? fmtHourRange(startAt, endAt, city.timezone) : null),
        durationText: single ? fmtDuration(startAt, endAt) : null,
        venueName: r.address_name?.trim() || null,
        address: address || null,
        lat: r.lat_lon.lat,
        lng: r.lat_lon.lon,
        city: city.slug,
        country: city.country,
        priceMin: prices.min,
        priceMax: prices.max,
        status,
        ticketUrl: r.access_type && r.access_type !== "non" && isHttpUrl(r.access_link) ? r.access_link : null,
        officialUrl: isHttpUrl(r.contact_url) ? r.contact_url : r.url,
        lang: r.locale ?? "fr",
      });
    }
    log(`${out.length} retenus, ${skipped} ignorés (hors catégories / incomplets)`);
    return out;
  },
};
