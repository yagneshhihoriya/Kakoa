import { ImageResponse } from "next/og";
import { brand } from "@/lib/brand";

/**
 * Shared brand-mark renderer for all generated icon routes (favicon, apple
 * touch icon, PWA manifest icons). The brand's initial on a themeColor gradient
 * square — no binary assets shipped; every icon is produced at build via
 * ImageResponse.
 */
export function renderBrandIcon(size: number): ImageResponse {
  const { profile } = brand;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `linear-gradient(145deg, ${profile.themeColor} 0%, #4A331F 100%)`,
          color: profile.backgroundColor,
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
