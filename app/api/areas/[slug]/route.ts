import { NextResponse } from "next/server";
import { getArea } from "@/lib/areas-server";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const area = await getArea((await params).slug);
  if (!area) return NextResponse.json({ error: "not-found" }, { status: 404 });
  return NextResponse.json({ area }, { headers: { "Cache-Control": "no-store" } });
}
