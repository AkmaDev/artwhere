import { NextResponse, type NextRequest } from "next/server";
import { isCategoryId } from "@/lib/categories";
import { getArea } from "@/lib/areas-server";
import { supabaseAdmin } from "@/lib/supabase";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f-]{36}$/i;
// Clé de lieu suivi : « ville|venue_norm » (voir lib/venue.ts).
const VENUE_KEY = /^[a-z0-9-]+\|[a-z0-9 ]{1,120}$/;
const MAX_VENUES = 100;

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  const sub = b?.subscription;
  const valid =
    b &&
    typeof b.deviceId === "string" &&
    UUID.test(b.deviceId) &&
    typeof sub?.endpoint === "string" &&
    sub.endpoint.startsWith("https://") &&
    typeof sub.keys?.p256dh === "string" &&
    typeof sub.keys?.auth === "string" &&
    typeof b.city === "string" &&
    !!(await getArea(b.city)) &&
    DAY.test(b.from) &&
    DAY.test(b.to) &&
    Array.isArray(b.cats) &&
    b.cats.every(isCategoryId) &&
    b.cats.length > 0 &&
    Array.isArray(b.moments) &&
    (b.frequency === "now" || b.frequency === "daily") &&
    (b.venues === undefined ||
      (Array.isArray(b.venues) && b.venues.length <= MAX_VENUES && b.venues.every((v: unknown) => typeof v === "string" && VENUE_KEY.test(v))));
  if (!valid) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const venues: string[] = b.venues ?? [];

  const row = {
    endpoint: sub.endpoint,
    device_id: b.deviceId,
    keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    city: b.city,
    date_from: b.from,
    date_to: b.to,
    categories: b.cats,
    moments: b.moments.filter((m: unknown) => m === "m" || m === "a" || m === "s"),
    frequency: b.frequency,
  };
  const table = supabaseAdmin().from("push_subscriptions");
  let { error } = await table.upsert({ ...row, venues }, { onConflict: "endpoint" });
  // Colonne `venues` absente (migration 0007 non appliquée) : on garde au moins l'alerte de recherche.
  if (error?.code === "PGRST204") ({ error } = await table.upsert(row, { onConflict: "endpoint" }));
  if (error) return NextResponse.json({ error: "db" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
