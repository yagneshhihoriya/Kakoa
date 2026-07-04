import { renderBrandIcon } from "@/lib/seo/icon";

/**
 * 192×192 PWA manifest icon at the literal `/icon-192.png` path (route
 * handler → ImageResponse, so no binary asset is committed).
 */
export function GET() {
  return renderBrandIcon(192);
}
