import { NextResponse, type NextRequest } from "next/server";
import { isCategoryId } from "@/lib/categories";
import { getCity } from "@/lib/cities";
import { hasSupabase, supabaseAdmin } from "@/lib/supabase";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f-]{36}$/i;

export async function POST(req: NextRequest) {
  if (!hasSupabase()) return NextResponse.json({ error: "not-configured" }, { status: 503 });
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
    getCity(b.city)?.active &&
    DAY.test(b.from) &&
    DAY.test(b.to) &&
    Array.isArray(b.cats) &&
    b.cats.every(isCategoryId) &&
    b.cats.length > 0 &&
    Array.isArray(b.moments) &&
    (b.frequency === "now" || b.frequency === "daily");
  if (!valid) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const { error } = await supabaseAdmin()
    .from("push_subscriptions")
    .upsert(
      {
        endpoint: sub.endpoint,
        device_id: b.deviceId,
        keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
        city: b.city,
        date_from: b.from,
        date_to: b.to,
        categories: b.cats,
        moments: b.moments.filter((m: unknown) => m === "m" || m === "a" || m === "s"),
        frequency: b.frequency,
      },
      { onConflict: "endpoint" },
    );
  if (error) return NextResponse.json({ error: "db" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
