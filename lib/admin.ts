import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { supabaseAdmin } from "./supabase";

export const ADMIN_COOKIE = "aw_admin";

/** Jeton du cookie : dérivé du mot de passe, il devient invalide si le mot de passe change. */
export function adminToken(): string | null {
  const pw = process.env.ADMIN_PASSWORD;
  return pw ? createHmac("sha256", pw).update("artwhere-admin-v1").digest("hex") : null;
}

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function checkPassword(input: string): boolean {
  const pw = process.env.ADMIN_PASSWORD;
  return !!pw && same(input, pw);
}

export async function isAdmin(): Promise<boolean> {
  const token = adminToken();
  const v = (await cookies()).get(ADMIN_COOKIE)?.value;
  return !!token && !!v && same(v, token);
}

export interface ProfileStats {
  total: number;
  age: Record<string, number>;
  gender: Record<string, number>;
  categories: Record<string, number>;
  cities: Record<string, number>;
  /** clé « catégorie|tranche d'âge » */
  catByAge: Record<string, number>;
  cityNames: Record<string, string>;
}

export async function loadStats(): Promise<ProfileStats> {
  const sb = supabaseAdmin();
  const { data, error } = await sb.rpc("profile_stats");
  if (error) throw error;
  const s = data as Omit<ProfileStats, "cityNames">;
  const slugs = Object.keys(s.cities ?? {});
  const cityNames: Record<string, string> = {};
  if (slugs.length) {
    const { data: rows } = await sb.from("cities").select("slug, name").in("slug", slugs);
    for (const r of rows ?? []) cityNames[r.slug as string] = r.name as string;
  }
  return { ...s, cityNames };
}
