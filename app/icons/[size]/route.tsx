import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const px = size === "512" ? 512 : size === "180" ? 180 : 192;
  const maskable = req.nextUrl.searchParams.get("maskable") === "1";
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1E1E1C",
          borderRadius: maskable || px === 180 ? 0 : px * 0.22,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", color: "#FFFFFF", fontSize: px * (maskable ? 0.42 : 0.56), fontWeight: 700, letterSpacing: -px * 0.02 }}>
          a<span style={{ color: "#2E3BD6" }}>.</span>
        </div>
      </div>
    ),
    { width: px, height: px },
  );
}
