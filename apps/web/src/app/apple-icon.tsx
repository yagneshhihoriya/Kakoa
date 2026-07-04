import { renderBrandIcon } from "@/lib/seo/icon";

/** Apple touch icon — 180×180 cocoa "K" mark (ImageResponse). */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return renderBrandIcon(180);
}
