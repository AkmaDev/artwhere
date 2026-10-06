import type { CategoryId } from "../../lib/categories";
import type { EventStatus } from "../../lib/types";
import { fmtHourRange, isHttpUrl, truncate } from "../normalize";
import type { Connector, NormalizedEvent } from "../types";

// https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/ — 5000 appels/jour, 1000 résultats max par recherche.
const API = "https://app.ticketmaster.com/discovery/v2/events.json";

interface TmEvent {
  id: string;
  name: string;
  url?: string;
  info?: string;
  pleaseNote?: string;
  images?: { url: string; width: number; height: number; ratio?: string }[];
  dates?: {
    start?: { dateTime?: string; localDate?: string; dateTBD?: boolean; timeTBA?: boolean };
    end?: { dateTime?: string };
    status?: { code?: string };
  };
  priceRanges?: { min?: number; max?: number; currency?: string }[];
  classifications?: { segment?: { name?: string }; genre?: { name?: string }; subGenre?: { name?: string } }[];
  _embedded?: {
    venues?: {
      name?: string;
      address?: { line1?: string };
      postalCode?: string;
      city?: { name?: string };
      location?: { latitude?: string; longitude?: string };
    }[];
  };
}

function categoriesFor(e: TmEvent): CategoryId[] {
  const out = new Set<CategoryId>();
  for (const c of e.classifications ?? []) {
    const seg = c.segment?.name ?? "";
    const genre = (c.genre?.name ?? "").toLowerCase();
    if (seg === "Music") out.add("concert");
    if (seg === "Film") out.add("cinema");
    if (seg === "Arts & Theatre") {
      if (/dance|ballet|danse/.test(genre)) out.add("danse");
      else if (/classical|opera|music/.test(genre)) out.add("concert");
      else if (/fine art|exhibit/.test(genre)) out.add("expo");
      else if (/theat|comedy|spectacle|musical|magic|circus|children/.test(genre)) out.add("theatre");
    }
    if (/festival/.test(genre) || /festival/i.test(e.name)) out.add("festival");
  }
  return [...out];
}

const STATUS: Record<string, EventStatus> = {
  onsale: "available",
  offsale: "closed",
  cancelled: "cancelled",
  canceled: "cancelled",
  postponed: "cancelled",
};

export const ticketmaster: Connector = {
  id: "ticketmaster",
  async fetch(city, log) {
    const key = process.env.TICKETMASTER_API_KEY;
    if (!key) {
      log("TICKETMASTER_API_KEY absente : ignoré");
      return null;
    }
    const out: NormalizedEvent[] = [];
    const start = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    const end = new Date(Date.now() + 120 * 86400e3).toISOString().replace(/\.\d{3}Z$/, "Z");
    let skipped = 0;

    for (const segment of ["Music", "Arts & Theatre", "Film"]) {
      for (let page = 0; page < 5; page++) {
        const params = new URLSearchParams({
          apikey: key,
          latlong: `${city.lat},${city.lng}`,
          radius: String(Math.round(city.radiusKm)),
          unit: "km",
          classificationName: segment,
          startDateTime: start,
          endDateTime: end,
          locale: "*",
          size: "200",
          page: String(page),
          sort: "date,asc",
        });
        const res = await fetch(`${API}?${params}`);
        if (res.status === 429) {
          await new Promise((r) => setTimeout(r, 1500));
          page--;
          continue;
        }
        if (!res.ok) throw new Error(`ticketmaster HTTP ${res.status}`);
        const body = (await res.json()) as { _embedded?: { events?: TmEvent[] }; page?: { totalPages?: number } };
        const events = body._embedded?.events ?? [];

        for (const e of events) {
          const v = e._embedded?.venues?.[0];
          const lat = Number(v?.location?.latitude);
          const lng = Number(v?.location?.longitude);
          const startAt = e.dates?.start?.dateTime;
          const categories = categoriesFor(e);
          if (!startAt || e.dates?.start?.dateTBD || !categories.length || !isHttpUrl(e.url) || !Number.isFinite(lat)) {
            skipped++;
            continue;
          }
          const endAt = e.dates?.end?.dateTime && e.dates.end.dateTime > startAt ? e.dates.end.dateTime : new Date(new Date(startAt).getTime() + 2 * 3600e3).toISOString();
          const prices = (e.priceRanges ?? []).filter((p) => p.currency === city.currency || !p.currency);
          const img = [...(e.images ?? [])].filter((i) => i.ratio === "16_9").sort((a, b) => b.width - a.width).find((i) => i.width <= 1200);
          const address = [v?.address?.line1, [v?.postalCode, v?.city?.name].filter(Boolean).join(" ")].filter(Boolean).join(", ");

          out.push({
            source: "ticketmaster",
            kind: "event",
            sourceId: e.id,
            sourceUrl: e.url!,
            raw: e,
            title: e.name.trim(),
            description: truncate(e.info ?? e.pleaseNote ?? null),
            imageUrl: img?.url ?? null,
            categories,
            occurrences: [[startAt, endAt]],
            startAt,
            endAt,
            allDay: false,
            hoursText: e.dates?.start?.timeTBA ? null : fmtHourRange(startAt, startAt, city.timezone),
            durationText: null,
            venueName: v?.name ?? null,
            address: address || null,
            lat,
            lng,
            city: city.slug,
            country: city.country,
            priceMin: prices.length ? Math.min(...prices.map((p) => p.min ?? Infinity)) : null,
            priceMax: prices.length ? Math.max(...prices.map((p) => p.max ?? 0)) : null,
            status: STATUS[e.dates?.status?.code ?? "onsale"] ?? "available",
            ticketUrl: e.url!,
            officialUrl: e.url!,
            lang: "fr",
          });
        }
        if (page + 1 >= (body.page?.totalPages ?? 0)) break;
        await new Promise((r) => setTimeout(r, 250));
      }
    }
    for (const e of out) if (e.priceMin === Infinity) e.priceMin = null;
    log(`${out.length} retenus, ${skipped} ignorés`);
    return out;
  },
};
