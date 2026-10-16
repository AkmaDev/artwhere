// Profil anonyme (partagé client/serveur) : rien n'est envoyé sans consentement.
export const AGE_RANGES = ["<18", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"] as const;
export const GENDERS = ["f", "m", "other", "na"] as const;
export const TOP_CITIES = 3;

export type AgeRange = (typeof AGE_RANGES)[number];
export type Gender = (typeof GENDERS)[number];

export interface Profile {
  consent: boolean;
  ageRange: AgeRange | null;
  gender: Gender | null;
  /** Parcours âge + genre terminé (« Je préfère ne pas répondre » compte) : on ne réinvite plus. */
  answeredAt: string | null;
}

export const DEFAULT_PROFILE: Profile = { consent: false, ageRange: null, gender: null, answeredAt: null };

/** Invitation au profil : au 1er favori, puis une seule fois au 3e après « Plus tard ». */
export interface ProfilePrompt {
  shown: number;
  lastShownAtFavCount: number;
  done: boolean;
}

export const DEFAULT_PROFILE_PROMPT: ProfilePrompt = { shown: 0, lastShownAtFavCount: 0, done: false };
export const REINVITE_AT = 3;

export function shouldInvite(prompt: ProfilePrompt, profile: Profile, favCount: number): boolean {
  if (profile.answeredAt || prompt.done) return false;
  if (prompt.shown === 0) return favCount >= 1;
  return prompt.shown === 1 && favCount >= REINVITE_AT && prompt.lastShownAtFavCount < REINVITE_AT;
}

/** « Plus tard » ou fermeture sans réponse. */
export function deferInvite(prompt: ProfilePrompt, favCount: number): ProfilePrompt {
  const shown = prompt.shown + 1;
  return { shown, lastShownAtFavCount: favCount, done: shown >= 2 };
}

export const isAgeRange = (v: unknown): v is AgeRange => (AGE_RANGES as readonly unknown[]).includes(v);
export const isGender = (v: unknown): v is Gender => (GENDERS as readonly unknown[]).includes(v);

/** Villes les plus consultées, par nombre de sélections. */
export function topCities(counts: Record<string, number>): string[] {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_CITIES)
    .map(([slug]) => slug);
}
