import { NextResponse, type NextRequest } from "next/server";
import { getEventsByIds } from "@/lib/events-repo";

export async function GET(req: NextRequest) {
  const ids = (req.nextUrl.searchParams.get("ids") ?? "").split(",").filter(Boolean);
  const events = await getEventsByIds(ids);
  return NextResponse.json({ events });
}
