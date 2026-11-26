import type { MetadataRoute } from "next";
import { brand } from "@/lib/brand";

/**
 * PWA web app manifest — brand identity for installable/standalone mode.
 * Icons reference the build-time generated `app/icon.tsx` output at their
 * conventional public paths; theme/background come from the brand profile.
 */
export default function manifest(): MetadataRoute.Manifest {
  const { profile } = brand;
  return {
    name: profile.name,
    short_name: profile.shortName,
    description: profile.seo.description,
    start_url: "/",
    display: "standalone",
    background_color: profile.backgroundColor,
    theme_color: profile.themeColor,
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
