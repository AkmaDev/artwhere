import { arrondissement, ordinalFr, shortArea } from "./format";
import type { EventItem } from "./types";

// Les événements n'ont pas de champ « quartier » : on ne donne que ce qui est fiable (arrondissement, ville).
// Le quartier vécu (« Le Marais ») n'est connu que pour la position de l'utilisateur (géocodeur).

/** « Paris 4e », « Lyon 2e »… ; null si l'adresse ne permet pas de le savoir. */
export function getNeighborhood(e: Pick<EventItem, "address">): string | null {
  const arr = arrondissement(e.address);
  return arr ? `${arr.city} ${ordinalFr(arr.n)}` : null;
}

/** Ville + arrondissement si connu, sinon la ville tirée de l'adresse ; null si rien. */
export function cityLabel(e: Pick<EventItem, "address">): string | null {
  return shortArea(e.address) || null;
}

export interface GeoPlace {
  lat: number;
  lng: number;
  street?: string | null;
  district?: string | null;
  postcode?: string | null;
}

/** Champs utiles d'une réponse du géocodeur inverse (Photon / OpenStreetMap). */
export interface GeoProps {
  type?: string;
  name?: string;
  street?: string;
  district?: string;
  locality?: string;
  city?: string;
  postcode?: string;
}

/** Rue de la position : champ `street`, ou le nom si le résultat est lui-même une rue. */
export function pickStreet(p: GeoProps): string | null {
  return p.street ?? (p.type === "street" ? (p.name ?? null) : null);
}

/**
 * Quartier vécu. À Paris, Photon met la ville dans `district` et le quartier dans `locality`
 * (« Quartier Saint-Merri ») : on ignore un district égal à la ville et on retire « Quartier ».
 */
export function pickDistrict(p: GeoProps): string | null {
  if (p.district && p.district !== p.city) return p.district;
  const loc = p.locality?.replace(/^Quartier\s+(de la |de l'|de l’|du |des |de |d'|d’)?/i, "").trim();
  return loc && loc !== p.city ? loc : null;
}

/** Libellé de la position : « Rue Rambuteau, 4e », sinon « Saint-Merri, 4e », « Saint-Merri » ou « 4e » ; null si inconnu. */
export function placeLabel(geo: GeoPlace | null): string | null {
  if (!geo) return null;
  const arr = arrondissement(geo.postcode);
  const n = arr ? ordinalFr(arr.n) : null;
  const where = geo.street || geo.district;
  if (where && n) return `${where}, ${n}`;
  return where || n || null;
}

/** Morceaux non vides séparés par « · » (jamais de « · · »). */
export function joinDots(parts: (string | null | undefined | false)[]): string {
  return parts.filter((p): p is string => !!p && p.trim() !== "").join(" · ");
}
