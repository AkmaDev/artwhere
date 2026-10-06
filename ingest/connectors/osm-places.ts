import { haversineKm } from "../../lib/area";
import type { CategoryId } from "../../lib/categories";
import { isHttpUrl, normText, truncate } from "../normalize";
import type { CityConfig, Connector, NormalizedEvent } from "../types";

// Lieux culturels permanents (musées, monuments, théâtres…) : OpenStreetMap (ODbL) + Wikidata (CC0).
const OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
const UA = "Artwhere/0.1 (https://artwhere.vercel.app; collecte de lieux culturels)";
const MAX_PLACES = 400;
const PLACE_TTL_DAYS = 400;

interface OsmElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

const GENERIC_NAMES = /^(monument|mus[ée]e|museum|memorial|m[ée]morial|statue|th[ée][aâ]tre|theatre|cin[ée]ma|cinema|galerie|gallery|ruines?|ruins?|fort|place)$/i;

function categoriesFor(t: Record<string, string>): CategoryId[] {
  const out = new Set<CategoryId>();
  if (t.tourism === "museum") out.add("musee");
  if (t.tourism === "gallery" || t.amenity === "arts_centre") out.add("expo");
  if (t.amenity === "theatre") out.add("theatre");
  if (t.amenity === "cinema") out.add("cinema");
  if (t.historic || t.heritage) out.add("patrimoine");
  if ((t.amenity || t.office) && new RegExp(CULTURAL_CENTRE, "i").test(t.name ?? "")) out.add("expo");
  if (t.tourism === "attraction" && !out.size) out.add("visite");
  return [...out];
}

const EXCURSION_KM = 80;
const CULTURAL_CENTRE = "Institut fran|Alliance fran|Goethe|Instituto Cervantes|British Council|Centre culturel|Cultural Cent|Maison de la culture";

// Deux requêtes courtes plutôt qu'une longue : les serveurs publics rejettent les grosses requêtes quand ils sont chargés.
function queries(c: CityConfig): string[] {
  const a = `(around:${Math.round(c.radiusKm * 1000)},${c.lat},${c.lng})`;
  // Second cercle : sites notables (fiche Wikidata) à distance d'excursion (Ouidah, Porto-Novo depuis Cotonou…).
  const x = `(around:${EXCURSION_KM * 1000},${c.lat},${c.lng})`;
  return [
    `[out:json][timeout:90];
(
  nwr["tourism"~"^(museum|gallery)$"]${a};
  nwr["amenity"~"^(theatre|arts_centre|cinema)$"]${a};
  nwr["amenity"~"^(community_centre|social_centre|school|college|library)$"]["name"~"${CULTURAL_CENTRE}",i]${a};
  nwr["office"]["name"~"${CULTURAL_CENTRE}",i]${a};
  nwr["historic"~"^(monument|castle|archaeological_site|ruins|fort|palace|city_gate|building|manor)$"]["name"]${a};
  nwr["historic"="memorial"]["wikidata"]${a};
  nwr["tourism"="attraction"]["historic"]${a};
  nwr["tourism"="attraction"]["wikidata"]${a};
);
out tags center;`,
    `[out:json][timeout:90];
(
  nwr["tourism"~"^(museum|gallery|attraction)$"]["wikidata"]${x};
  nwr["historic"]["wikidata"]${x};
);
out tags center;`,
  ];
}

async function overpass(q: string, log: (m: string) => void): Promise<OsmElement[]> {
  // Serveurs publics souvent saturés (504) : deux tours sur les miroirs, avec une pause.
  for (const [round, url] of [...OVERPASS, ...OVERPASS].entries()) {
    if (round === OVERPASS.length) await new Promise((r) => setTimeout(r, 30_000));
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ data: q }),
        signal: AbortSignal.timeout(200_000),
      });
      const text = await res.text();
      if (res.ok && text.startsWith("{")) return (JSON.parse(text) as { elements: OsmElement[] }).elements;
      log(`${new URL(url).host} : réponse ${res.status}, miroir suivant`);
    } catch (e) {
      log(`${new URL(url).host} : ${(e as Error).message}, miroir suivant`);
    }
  }
  throw new Error("aucun serveur Overpass n'a répondu");
}

interface WikiInfo {
  description: string | null;
  image: string | null;
  website: string | null;
  wikipedia: string | null;
}

async function wikidata(ids: string[]): Promise<Map<string, WikiInfo>> {
  const out = new Map<string, WikiInfo>();
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const p = new URLSearchParams({
      action: "wbgetentities",
      ids: batch.join("|"),
      props: "descriptions|claims|sitelinks/urls",
      languages: "fr|en",
      sitefilter: "frwiki|enwiki",
      format: "json",
    });
    const res = await fetch(`https://www.wikidata.org/w/api.php?${p}`, { headers: { "User-Agent": UA } });
    if (!res.ok) continue;
    const body = (await res.json()) as {
      entities: Record<
        string,
        {
          descriptions?: Record<string, { value: string }>;
          claims?: Record<string, { mainsnak?: { datavalue?: { value: unknown } } }[]>;
          sitelinks?: Record<string, { url?: string }>;
        }
      >;
    };
    for (const [id, e] of Object.entries(body.entities ?? {})) {
      const claim = (p: string) => e.claims?.[p]?.[0]?.mainsnak?.datavalue?.value;
      const img = claim("P18");
      const site = claim("P856");
      out.set(id, {
        description: e.descriptions?.fr?.value ?? e.descriptions?.en?.value ?? null,
        image: typeof img === "string" ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(img)}?width=800` : null,
        website: typeof site === "string" && isHttpUrl(site) ? site : null,
        wikipedia: e.sitelinks?.frwiki?.url ?? e.sitelinks?.enwiki?.url ?? null,
      });
    }
  }
  return out;
}

const DAYS: Record<string, string> = { Mo: "lun.", Tu: "mar.", We: "mer.", Th: "jeu.", Fr: "ven.", Sa: "sam.", Su: "dim.", PH: "jours fériés" };
function frenchHours(oh: string | undefined): string | null {
  if (!oh) return null;
  if (oh.trim() === "24/7") return "Tous les jours, 24 h/24";
  const s = oh
    .replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su|PH)\b/g, (d) => DAYS[d])
    .replace(/(\d{1,2}):(\d{2})/g, (_, h, m) => `${h}h${m === "00" ? "" : m}`)
    .replace(/\boff\b/g, "fermé")
    .replace(/\s*;\s*/g, " · ")
    .replace(/-/g, "–");
  return s.length <= 120 ? s : null;
}

function address(t: Record<string, string>): string | null {
  const street = [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" ");
  const city = [t["addr:postcode"], t["addr:city"]].filter(Boolean).join(" ");
  return [street, city].filter(Boolean).join(", ") || null;
}

export const osmPlaces: Connector = {
  id: "osm",
  async fetch(city, log) {
    const elements: OsmElement[] = [];
    for (const q of queries(city)) elements.push(...(await overpass(q, log)));
    log(`${elements.length} éléments OpenStreetMap`);

    const candidates = elements
      .map((el) => {
        const t = el.tags ?? {};
        const name = (t["name:fr"] ?? t.name ?? "").trim();
        const lat = el.lat ?? el.center?.lat;
        const lng = el.lon ?? el.center?.lon;
        const categories = categoriesFor(t);
        if (!name || GENERIC_NAMES.test(name) || lat == null || lng == null || !categories.length) return null;
        // Les lieux documentés (Wikidata, site, horaires) passent en premier quand il faut limiter.
        const score = (t.wikidata ? 4 : 0) + (t.website || t["contact:website"] ? 2 : 0) + (t.opening_hours ? 1 : 0) + (t.tourism ? 1 : 0);
        return { el, t, name, lat, lng, categories, score };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.score - a.score)
      // Un même lieu est souvent cartographié deux fois (point + contour) : on garde le mieux renseigné.
      .filter((x, i, arr) => !arr.slice(0, i).some((y) => normText(y.name) === normText(x.name) && haversineKm(x.lat, x.lng, y.lat, y.lng) < 0.5))
      .slice(0, MAX_PLACES);

    const wd = await wikidata([...new Set(candidates.map((c) => c.t.wikidata).filter((x): x is string => !!x && /^Q\d+$/.test(x)))]);
    log(`${candidates.length} lieux retenus, ${wd.size} enrichis par Wikidata`);

    const now = new Date();
    const until = new Date(now.getTime() + PLACE_TTL_DAYS * 86400e3);
    return candidates.map(({ el, t, name, lat, lng, categories }): NormalizedEvent => {
      const w = t.wikidata ? wd.get(t.wikidata) : undefined;
      const website = [t.website, t["contact:website"], t.url, w?.website].find(isHttpUrl) ?? w?.wikipedia ?? null;
      const osmUrl = `https://www.openstreetmap.org/${el.type}/${el.id}`;
      return {
        source: "osm",
        kind: "place",
        sourceId: `${el.type}/${el.id}`,
        sourceUrl: osmUrl,
        raw: t,
        title: name,
        description: truncate(t.description ?? w?.description ?? null, 400),
        imageUrl: [t.image, w?.image].find(isHttpUrl) ?? null,
        categories,
        occurrences: [],
        startAt: now.toISOString(),
        endAt: until.toISOString(),
        allDay: true,
        hoursText: frenchHours(t.opening_hours),
        durationText: null,
        venueName: name,
        address: address(t),
        lat,
        lng,
        city: city.slug,
        country: city.country,
        priceMin: t.fee === "no" ? 0 : null,
        priceMax: t.fee === "no" ? 0 : null,
        status: "available",
        ticketUrl: null,
        officialUrl: website ?? osmUrl,
        lang: "fr",
      };
    });
  },
};
