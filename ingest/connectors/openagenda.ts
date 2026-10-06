import type { CategoryId } from "../../lib/categories";
import type { EventStatus } from "../../lib/types";
import { fmtDuration, fmtHourRange, isHttpUrl, looksOngoing, normText, parsePrices, stripHtml, truncate } from "../normalize";
import type { Connector, NormalizedEvent } from "../types";

// https://developers.openagenda.com/ — clé gratuite. On interroge une liste d'agendas choisis par ville.
const API = "https://api.openagenda.com/v2";

type I18n = Record<string, string> | string | null | undefined;
const tr = (v: I18n): string | null => (v == null ? null : typeof v === "string" ? v : (v.fr ?? Object.values(v)[0] ?? null));

interface OaEvent {
  uid: number;
  slug?: string;
  title: I18n;
  description?: I18n;
  longDescription?: I18n;
  keywords?: Record<string, string[]> | null;
  image?: { base?: string; filename?: string } | null;
  conditions?: I18n;
  registration?: { type?: string; value?: string }[];
  timings?: { begin: string; end: string }[];
  status?: number;
  location?: { name?: string; address?: string; latitude?: number; longitude?: string | number; city?: string; postalCode?: string };
  onlineAccessLink?: string | null;
  attendanceMode?: number;
}

const KEYWORDS: [RegExp, CategoryId][] = [
  [/\b(exposition|expo|vernissage|photographie|peinture|art contemporain)\b/, "expo"],
  [/\bmusee\b/, "musee"],
  [/\b(concert|recital|jazz|orchestre|opera|musique classique|chorale)\b/, "concert"],
  [/\b(theatre|comedie|piece|marionnette|seul en scene)\b/, "theatre"],
  [/\b(danse|ballet|choregraph)/, "danse"],
  [/\b(cinema|projection|film|cine)\b/, "cinema"],
  [/\bfestival\b/, "festival"],
  [/\b(visite guidee|visite commentee|balade|parcours decouverte)\b/, "visite"],
  [/\b(patrimoine|monument|journees europeennes du patrimoine|chateau|basilique|cathedrale)\b/, "patrimoine"],
  [/\b(atelier|stage|initiation)\b/, "atelier"],
];

function categoriesFor(text: string): CategoryId[] {
  const t = normText(text);
  return [...new Set(KEYWORDS.filter(([re]) => re.test(t)).map(([, c]) => c))];
}

// 1 programmé, 2 reprogrammé, 3 en ligne, 4 reporté, 5 complet, 6 annulé
const STATUS: Record<number, EventStatus> = { 1: "available", 2: "available", 4: "cancelled", 5: "full", 6: "cancelled" };

/** Agendas OpenAgenda suivis par ville (UID). À compléter avec les agendas des offices de tourisme / villes. */
export const OPENAGENDA_AGENDAS: Record<string, number[]> = {
  paris: (process.env.OPENAGENDA_AGENDAS_PARIS ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => n > 0),
};

export const openagenda: Connector = {
  id: "openagenda",
  async fetch(city, log) {
    const key = process.env.OPENAGENDA_API_KEY;
    const agendas = OPENAGENDA_AGENDAS[city.slug] ?? [];
    if (!key || !agendas.length) {
      log("OPENAGENDA_API_KEY ou agendas absents : ignoré");
      return null;
    }
    const out: NormalizedEvent[] = [];
    let skipped = 0;

    for (const agenda of agendas) {
      let after: string[] | undefined;
      for (let guard = 0; guard < 30; guard++) {
        const p = new URLSearchParams({ key, size: "300", detailed: "1", monolingual: "fr" });
        p.append("relative[]", "current");
        p.append("relative[]", "upcoming");
        for (const a of after ?? []) p.append("after[]", a);
        const res = await fetch(`${API}/agendas/${agenda}/events?${p}`);
        if (!res.ok) throw new Error(`openagenda ${agenda} HTTP ${res.status}`);
        const body = (await res.json()) as { events: OaEvent[]; after?: string[] | null };

        for (const e of body.events) {
          const title = tr(e.title);
          const loc = e.location;
          const lat = Number(loc?.latitude);
          const lng = Number(loc?.longitude);
          const occ = (e.timings ?? [])
            .map((t) => [new Date(t.begin).toISOString(), new Date(t.end).toISOString()] as [string, string])
            .sort((a, b) => a[0].localeCompare(b[0]))
            .slice(0, 400);
          const kw = Object.values(e.keywords ?? {}).flat().join(" ");
          const categories = categoriesFor(`${title} ${kw} ${tr(e.description) ?? ""}`);
          const link = (e.registration ?? []).find((r) => r.type === "link" && isHttpUrl(r.value))?.value ?? null;
          const official = `https://openagenda.com/agendas/${agenda}/events/${e.slug ?? e.uid}`;
          if (!title || !occ.length || !categories.length || !Number.isFinite(lat) || e.attendanceMode === 2) {
            skipped++;
            continue;
          }
          const startAt = occ[0][0];
          const endAt = occ.reduce((mx, o) => (o[1] > mx ? o[1] : mx), occ[0][1]);
          const allDay = looksOngoing({ startAt, endAt, occurrences: occ });
          const single = !allDay && occ.length === 1;
          const cond = tr(e.conditions);
          const free = !!cond && /\b(gratuit|entree libre|libre)\b/.test(normText(cond));
          const prices = free ? { min: 0, max: 0 } : parsePrices(cond);
          const image = e.image?.base && e.image.filename ? `${e.image.base}${e.image.filename}` : null;

          out.push({
            source: "openagenda",
            sourceId: String(e.uid),
            sourceUrl: official,
            raw: e,
            title: title.trim(),
            description: truncate(stripHtml(tr(e.description)) ?? stripHtml(tr(e.longDescription))),
            imageUrl: isHttpUrl(image) ? image : null,
            categories,
            occurrences: allDay ? [] : occ,
            startAt,
            endAt,
            allDay,
            hoursText: single ? fmtHourRange(startAt, endAt, city.timezone) : null,
            durationText: single ? fmtDuration(startAt, endAt) : null,
            venueName: loc?.name ?? null,
            address: loc?.address ?? null,
            lat,
            lng,
            city: city.slug,
            country: city.country,
            priceMin: prices.min,
            priceMax: prices.max,
            status: STATUS[e.status ?? 1] ?? "available",
            ticketUrl: link,
            officialUrl: official,
            lang: "fr",
          });
        }
        if (!body.after || !body.events.length) break;
        after = body.after;
      }
    }
    log(`${out.length} retenus, ${skipped} ignorés`);
    return out;
  },
};
