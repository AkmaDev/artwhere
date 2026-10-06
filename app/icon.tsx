import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#1E1E1C", borderRadius: 14 }}>
        <div style={{ display: "flex", color: "#FFFFFF", fontSize: 40, fontWeight: 700 }}>
          a<span style={{ color: "#2E3BD6" }}>.</span>
        </div>
      </div>
    ),
    size,
  );
}
