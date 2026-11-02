import { ImageResponse } from "next/og";
import { brand } from "@/lib/brand";

export const alt = brand.og.alt;
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
          background: brand.og.background,
          color: brand.og.ink,
          fontFamily: "serif",
        }}
      >
        <div style={{ fontSize: 120, fontWeight: 800, letterSpacing: 12 }}>
          {brand.profile.name}
        </div>
        <div style={{ marginTop: 8, fontSize: 34, color: brand.og.accent, letterSpacing: 2 }}>
          {brand.og.tagline}
        </div>
      </div>
    ),
    { ...size },
  );
}
