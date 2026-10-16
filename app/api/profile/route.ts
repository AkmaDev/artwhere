import { NextResponse, type NextRequest } from "next/server";
import { isCategoryId, MAX_CATEGORIES } from "@/lib/categories";
import { isAgeRange, isGender, TOP_CITIES } from "@/lib/profile";
import { supabaseAdmin } from "@/lib/supabase";
import { isTasteScores } from "@/lib/taste";

const UUID = /^[0-9a-f-]{36}$/i;

// Appelé uniquement quand l'utilisateur a donné son accord (voir lib/profile-client.ts).
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  const valid =
    b &&
    typeof b.deviceId === "string" &&
    UUID.test(b.deviceId) &&
    Array.isArray(b.categories) &&
    b.categories.length <= MAX_CATEGORIES &&
    b.categories.every(isCategoryId) &&
    (b.ageRange === null || isAgeRange(b.ageRange)) &&
    (b.gender === null || isGender(b.gender)) &&
    Array.isArray(b.topCities) &&
    b.topCities.length <= TOP_CITIES &&
    b.topCities.every((s: unknown) => typeof s === "string" && s.length <= 60) &&
    (b.taste === undefined || isTasteScores(b.taste));
  if (!valid) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const sb = supabaseAdmin();
  let cities: string[] = [];
  if (b.topCities.length) {
    const { data } = await sb.from("cities").select("slug").in("slug", b.topCities);
    const known = new Set((data ?? []).map((r) => r.slug as string));
    cities = (b.topCities as string[]).filter((s) => known.has(s));
  }

  const row = {
    device_id: b.deviceId,
    categories: b.categories,
    age_range: b.ageRange,
    gender: b.gender,
    top_cities: cities,
    updated_at: new Date().toISOString(),
  };
  const table = sb.from("user_profiles");
  let { error } = await table.upsert({ ...row, taste: b.taste ?? {} }, { onConflict: "device_id" });
  // Colonne `taste` absente (migration 0007 non appliquée) : le reste du profil est enregistré.
  if (error?.code === "PGRST204") ({ error } = await table.upsert(row, { onConflict: "device_id" }));
  if (error) return NextResponse.json({ error: "db" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// Retrait du consentement : effacement immédiat.
export async function DELETE(req: NextRequest) {
  const b = await req.json().catch(() => null);
  if (typeof b?.deviceId !== "string" || !UUID.test(b.deviceId)) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const { error } = await supabaseAdmin().from("user_profiles").delete().eq("device_id", b.deviceId);
  if (error) return NextResponse.json({ error: "db" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
