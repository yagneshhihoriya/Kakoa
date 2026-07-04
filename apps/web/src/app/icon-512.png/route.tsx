import { renderBrandIcon } from "@/lib/seo/icon";

/**
 * 512×512 PWA manifest icon at the literal `/icon-512.png` path (route
 * handler → ImageResponse, so no binary asset is committed).
 */
export function GET() {
  return renderBrandIcon(512);
}
