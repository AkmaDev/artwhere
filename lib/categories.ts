export const CATEGORY_IDS = [
  "expo",
  "musee",
  "concert",
  "theatre",
  "danse",
  "cinema",
  "festival",
  "visite",
  "patrimoine",
  "atelier",
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

export const MAX_CATEGORIES = 4;

export function isCategoryId(v: string): v is CategoryId {
  return (CATEGORY_IDS as readonly string[]).includes(v);
}
