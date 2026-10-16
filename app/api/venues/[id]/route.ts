import { NextResponse } from "next/server";
import { getVenueData } from "@/lib/events-repo";

// Page lieu : événements à venir d'un lieu + infos du lieu culturel s'il est référencé.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let data;
  try {
    data = await getVenueData((await params).id);
  } catch {
    return NextResponse.json({ error: "db" }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "not-found" }, { status: 404 });
  return NextResponse.json(data, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
}
