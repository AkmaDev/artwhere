import { NextResponse, type NextRequest } from "next/server";
import { resolveArea } from "@/lib/areas-server";

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  const ok =
    b &&
    typeof b.name === "string" &&
    b.name.length > 0 &&
    b.name.length <= 80 &&
    typeof b.countryCode === "string" &&
    /^[a-z]{2}$/i.test(b.countryCode) &&
    Number.isFinite(b.lat) &&
    Number.isFinite(b.lng) &&
    Math.abs(b.lat) <= 90 &&
    Math.abs(b.lng) <= 180;
  if (!ok) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const area = await resolveArea({
    name: b.name.trim(),
    country: String(b.country ?? b.countryCode),
    countryCode: b.countryCode,
    region: null,
    lat: b.lat,
    lng: b.lng,
  });
  return NextResponse.json({ area });
}
