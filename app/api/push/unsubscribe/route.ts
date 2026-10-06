import { NextResponse, type NextRequest } from "next/server";
import { hasSupabase, supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  if (!hasSupabase()) return NextResponse.json({ ok: true });
  const b = await req.json().catch(() => null);
  if (typeof b?.endpoint !== "string" || typeof b?.deviceId !== "string") {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  await supabaseAdmin().from("push_subscriptions").delete().eq("endpoint", b.endpoint).eq("device_id", b.deviceId);
  return NextResponse.json({ ok: true });
}
