import { renderBrandIcon } from "@/lib/seo/icon";

/** Favicon — cocoa gradient square with a serif "K" (ImageResponse). */
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return renderBrandIcon(64);
}
