"use client";

import { getDeviceId } from "./device";
import type { AgeRange, Gender } from "./profile";

export interface ProfilePayload {
  categories: string[];
  ageRange: AgeRange | null;
  gender: Gender | null;
  topCities: string[];
  /** Scores de goût agrégés par catégorie (lib/taste.ts), jamais la liste des événements vus. */
  taste?: Record<string, number>;
}

/** À n'appeler que si l'utilisateur a donné son accord. */
export async function sendProfile(p: ProfilePayload): Promise<boolean> {
  const res = await fetch("/api/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId: getDeviceId(), ...p }),
  }).catch(() => null);
  return !!res?.ok;
}

export async function deleteProfile(): Promise<boolean> {
  const res = await fetch("/api/profile", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId: getDeviceId() }),
  }).catch(() => null);
  return !!res?.ok;
}
