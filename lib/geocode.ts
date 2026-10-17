import "server-only";
import type { Place } from "./area";
import { pickDistrict, pickStreet } from "./neighborhood";

// Photon (komoot) : géocodeur OpenStreetMap gratuit, sans clé.
const PHOTON = "https://photon.komoot.io";
const UA = "Artwhere/0.1 (https://artwhere.vercel.app)";
const CITY_TYPES = new Set(["city", "town", "village", "municipality", "locality", "district", "county"]);

interface Feature {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    city?: string;
    county?: string;
    state?: string;
    country?: string;
    countrycode?: string;
    type?: string;
    osm_value?: string;
    street?: string;
    district?: string;
    locality?: string;
    postcode?: string;
  };
}

function toPlace(f: Feature, useCityField: boolean): Place | null {
  const p = f.properties;
  const name = useCityField ? (p.city ?? (CITY_TYPES.has(p.type ?? "") ? p.name : p.county)) : p.name;
  if (!name || !p.countrycode) return null;
  const [lng, lat] = f.geometry.coordinates;
  return { name, country: p.country ?? p.countrycode, countryCode: p.countrycode, region: p.state ?? null, lat, lng };
}

export async function searchPlaces(q: string, lang: string): Promise<Place[]> {
  const params = new URLSearchParams({ q, limit: "8", lang });
  params.append("layer", "city");
  params.append("layer", "locality");
  const res = await fetch(`${PHOTON}/api/?${params}`, { headers: { "User-Agent": UA }, next: { revalidate: 86400 } });
  if (!res.ok) throw new Error(`photon ${res.status}`);
  const body = (await res.json()) as { features: Feature[] };
  const seen = new Set<string>();
  return body.features
    .map((f) => toPlace(f, false))
    .filter((p): p is Place => {
      if (!p) return false;
      const k = `${p.name}|${p.countryCode}|${p.region}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 6);
}

export async function reversePlace(lat: number, lng: number, lang: string): Promise<Place | null> {
  const params = new URLSearchParams({ lat: String(lat), lon: String(lng), lang });
  const res = await fetch(`${PHOTON}/reverse?${params}`, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`photon ${res.status}`);
  const body = (await res.json()) as { features: Feature[] };
  const f = body.features[0];
  const place = f ? toPlace(f, true) : null;
  if (!place) return null;
  // Rue, quartier vécu et code postal, pour le libellé de la position (« Rue Rambuteau, 4e »).
  const p = f.properties;
  return { ...place, lat, lng, street: pickStreet(p), district: pickDistrict(p), postcode: p.postcode ?? null };
}
