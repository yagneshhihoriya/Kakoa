import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/seo/site";

/**
 * PWA web app manifest — brand identity for installable/standalone mode.
 * Icons reference the build-time generated `app/icon.tsx` output at their
 * conventional public paths; theme/background use the cocoa/cream brand.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.name,
    short_name: BRAND.shortName,
    description:
      "Small-batch bean-to-bar chocolate, crafted in India. Bars, pralines, and signature collections.",
    start_url: "/",
    display: "standalone",
    background_color: BRAND.backgroundColor,
    theme_color: BRAND.themeColor,
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
