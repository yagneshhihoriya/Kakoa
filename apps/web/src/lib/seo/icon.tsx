import { ImageResponse } from "next/og";
import { brand } from "@/lib/brand";

/**
 * Shared brand-mark renderer for all generated icon routes (favicon, apple
 * touch icon, PWA manifest icons). The brand's initial on the pack's icon
 * gradient square — no binary assets shipped; every icon is produced at build
 * via ImageResponse. Colours come from `brand.icon` (literal — Satori cannot
 * resolve CSS custom properties).
 */
export function renderBrandIcon(size: number): ImageResponse {
  const { profile, icon } = brand;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: icon.background,
          color: icon.ink,
          fontSize: Math.round(size * 0.62),
          fontWeight: 700,
          fontFamily: "Georgia, 'Times New Roman', serif",
          lineHeight: 1,
        }}
      >
        {profile.name.charAt(0)}
      </div>
    ),
    { width: size, height: size },
  );
}
