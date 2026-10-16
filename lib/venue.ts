import { normVenue } from "../ingest/normalize";

// Identifiant de lieu stable et partageable : « {ville}--{venue_norm avec des tirets} », ex. « paris--sunside ».
// venue_norm est la clé déjà utilisée en base pour fusionner les doublons de lieux.

const SLUG = /^[a-z0-9-]+$/;

export function venueId(city: string | null | undefined, venueName: string | null | undefined): string | null {
  const norm = normVenue(venueName ?? null);
  if (!city || !norm) return null;
  return `${city}--${norm.replace(/ /g, "-")}`;
}

export function parseVenueId(id: string): { city: string; norm: string } | null {
  const i = id.indexOf("--");
  if (i <= 0) return null;
  const city = id.slice(0, i);
  const slug = id.slice(i + 2);
  if (!SLUG.test(city) || !SLUG.test(slug) || slug.length > 120) return null;
  return { city, norm: slug.replace(/-/g, " ") };
}

/** Clé utilisée côté serveur pour les alertes (push_subscriptions.venues). */
export function venueKey(id: string): string | null {
  const p = parseVenueId(id);
  return p ? `${p.city}|${p.norm}` : null;
}
