import { CATEGORY_IDS, isCategoryId } from "./categories";
import { isBlocked } from "./format";
import type { EventItem } from "./types";
import { getUrgency } from "./urgency";

// Goûts appris (Quick Match et favoris) : un score par catégorie, gardé sur l'appareil.
// N'est envoyé au serveur qu'avec le consentement du profil anonyme (scores agrégés seulement).
export type TasteScores = Record<string, number>;
export type SwipeKind = "keep" | "pass" | "fav";

export const TASTE_MIN = -10;
export const TASTE_MAX = 20;
export const SEEN_MAX = 300;
export const DECK_SIZE = 10;
export const DECK_MIN = 5;
const PER_CATEGORY = 3;
const DELTA: Record<SwipeKind, number> = { keep: 2, pass: -1, fav: 1 };

export function recordSwipe(scores: TasteScores, categories: readonly string[], kind: SwipeKind): TasteScores {
  const next = { ...scores };
  for (const c of categories) next[c] = Math.min(TASTE_MAX, Math.max(TASTE_MIN, (next[c] ?? 0) + DELTA[kind]));
  return next;
}

export function addSeen(seen: string[], id: string): string[] {
  return [...seen.filter((x) => x !== id), id].slice(-SEEN_MAX);
}

/**
 * Paquet de cartes : exclut favoris, déjà vus et événements complets / clôturés / annulés ;
 * 3 au plus par catégorie principale ; alterne urgents et autres ; sans image en dernier recours.
 */
export function buildDeck(events: EventItem[], opts: { favIds: Set<string>; seen: Set<string>; now?: Date }): EventItem[] {
  const pool = events.filter((e) => e.kind === "event" && !isBlocked(e.status) && !opts.favIds.has(e.id) && !opts.seen.has(e.id));
  const withImg = pool.filter((e) => e.imageUrl);
  const noImg = pool.filter((e) => !e.imageUrl);
  const per: Record<string, number> = {};
  const picked: EventItem[] = [];
  const take = (list: EventItem[]) => {
    for (const e of list) {
      if (picked.length >= DECK_SIZE) return;
      const c = e.categories[0] ?? "";
      if ((per[c] ?? 0) >= PER_CATEGORY) continue;
      per[c] = (per[c] ?? 0) + 1;
      picked.push(e);
    }
  };
  // Ordre de départ : urgents et autres en alternance, chacun dans l'ordre chronologique.
  const byDate = (a: EventItem, b: EventItem) => a.nextAt.localeCompare(b.nextAt);
  const urgent = withImg.filter((e) => getUrgency(e, opts.now)).sort(byDate);
  const rest = withImg.filter((e) => !getUrgency(e, opts.now)).sort(byDate);
  const mixed: EventItem[] = [];
  for (let i = 0; i < Math.max(urgent.length, rest.length); i++) {
    if (rest[i]) mixed.push(rest[i]);
    if (urgent[i]) mixed.push(urgent[i]);
  }
  take(mixed);
  take(noImg.sort(byDate));
  return picked;
}

/** Ordre des rangées d'Explorer : score de goût, puis nombre d'événements. */
export function rankRows<T extends { cat: string; events: unknown[] }>(rows: T[], scores: TasteScores): T[] {
  return [...rows].sort((a, b) => (scores[b.cat] ?? 0) - (scores[a.cat] ?? 0) || b.events.length - a.events.length);
}

/** Validation côté serveur des scores reçus avec le profil. */
export function isTasteScores(v: unknown): v is TasteScores {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const entries = Object.entries(v);
  return (
    entries.length <= CATEGORY_IDS.length &&
    entries.every(([k, n]) => isCategoryId(k) && typeof n === "number" && Number.isInteger(n) && n >= TASTE_MIN && n <= TASTE_MAX)
  );
}
