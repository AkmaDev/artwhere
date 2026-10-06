import { NextResponse, type NextRequest } from "next/server";
import { isCategoryId } from "@/lib/categories";
import { searchEvents } from "@/lib/events-repo";
import type { Moment, SearchQuery } from "@/lib/types";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function num(v: string | null): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const from = p.get("from") ?? "";
  const to = p.get("to") ?? from;
  if (!DAY.test(from) || !DAY.test(to) || to < from) {
    return NextResponse.json({ error: "Dates invalides" }, { status: 400 });
  }
  const cats = (p.get("cats") ?? "").split(",").filter(isCategoryId);
  if (!cats.length) return NextResponse.json({ error: "Catégories manquantes" }, { status: 400 });

  const q: SearchQuery = {
    city: p.get("city") ?? "paris",
    from,
    to,
    cats,
    moments: (p.get("moments") ?? "").split(",").filter((m): m is Moment => m === "m" || m === "a" || m === "s"),
    free: p.get("free") === "1",
    lat: num(p.get("lat")),
    lng: num(p.get("lng")),
    maxKm: num(p.get("maxKm")),
  };

  const events = await searchEvents(q);
  return NextResponse.json({ events }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
}
