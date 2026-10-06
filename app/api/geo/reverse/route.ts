import { NextResponse, type NextRequest } from "next/server";
import { reversePlace } from "@/lib/geocode";

export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lng = Number(req.nextUrl.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  try {
    const place = await reversePlace(lat, lng, "fr");
    return place ? NextResponse.json({ place }) : NextResponse.json({ error: "not-found" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "geocoder" }, { status: 502 });
  }
}
