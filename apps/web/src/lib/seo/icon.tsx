import { ImageResponse } from "next/og";
import { BRAND } from "./site";

/**
 * Shared brand-mark renderer for all generated icon routes (favicon, apple
 * touch icon, PWA manifest icons). A serif "K" on a cocoa gradient square —
 * no binary assets shipped; every icon is produced at build via ImageResponse.
 */
export function renderBrandIcon(size: number): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `linear-gradient(145deg, ${BRAND.themeColor} 0%, #4A331F 100%)`,
          color: BRAND.backgroundColor,
          fontSize: Math.round(size * 0.62),
          fontWeight: 700,
          fontFamily: "Georgia, 'Times New Roman', serif",
          lineHeight: 1,
        }}
      >
        K
      </div>
    ),
    { width: size, height: size },
  );
}
