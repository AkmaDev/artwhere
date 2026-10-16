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
  district?: string | null;
  postcode?: string | null;
}

/** Libellé de la position de l'utilisateur : « Le Marais, 4e », « Le Marais » ou « 4e » ; null si inconnu. */
export function placeLabel(geo: GeoPlace | null): string | null {
  if (!geo) return null;
  const arr = arrondissement(geo.postcode);
  const n = arr ? ordinalFr(arr.n) : null;
  if (geo.district && n) return `${geo.district}, ${n}`;
  return geo.district || n || null;
}

/** Morceaux non vides séparés par « · » (jamais de « · · »). */
export function joinDots(parts: (string | null | undefined | false)[]): string {
  return parts.filter((p): p is string => !!p && p.trim() !== "").join(" · ");
}
