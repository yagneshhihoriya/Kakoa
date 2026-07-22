import { ImageResponse } from "next/og";

export const alt = "KAKOA — Small-Batch Chocolate";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Default social share (OpenGraph/Twitter) image for every page that doesn't
 * set its own (the PDP overrides with the product photo). A branded card so
 * links shared on WhatsApp/social render with an image instead of nothing.
 */
export default function OpengraphImage(): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #2A1D12 0%, #4A2E1C 100%)",
          color: "#FBF6EF",
          fontFamily: "serif",
        }}
      >
        <div style={{ fontSize: 120, fontWeight: 800, letterSpacing: 12 }}>KAKAO</div>
        <div style={{ marginTop: 8, fontSize: 34, color: "#E8C9A0", letterSpacing: 2 }}>
          Small-batch bean-to-bar chocolate
        </div>
      </div>
    ),
    { ...size },
  );
}
