// Profil anonyme (partagé client/serveur) : rien n'est envoyé sans consentement.
export const AGE_RANGES = ["<18", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"] as const;
export const GENDERS = ["f", "m", "other", "na"] as const;
export const TOP_CITIES = 3;

export type AgeRange = (typeof AGE_RANGES)[number];
export type Gender = (typeof GENDERS)[number];

export interface Profile {
  /** La feuille de profil a déjà été proposée (on ne la repropose pas). */
  asked: boolean;
  consent: boolean;
  ageRange: AgeRange | null;
  gender: Gender | null;
}

export const DEFAULT_PROFILE: Profile = { asked: false, consent: false, ageRange: null, gender: null };

export const isAgeRange = (v: unknown): v is AgeRange => (AGE_RANGES as readonly unknown[]).includes(v);
export const isGender = (v: unknown): v is Gender => (GENDERS as readonly unknown[]).includes(v);

/** Villes les plus consultées, par nombre de sélections. */
export function topCities(counts: Record<string, number>): string[] {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_CITIES)
    .map(([slug]) => slug);
}
