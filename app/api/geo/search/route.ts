import { NextResponse, type NextRequest } from "next/server";
import { searchPlaces } from "@/lib/geocode";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ places: [] });
  try {
    const places = await searchPlaces(q, "fr");
    return NextResponse.json({ places }, { headers: { "Cache-Control": "public, s-maxage=86400" } });
  } catch {
    return NextResponse.json({ error: "geocoder" }, { status: 502 });
  }
}
