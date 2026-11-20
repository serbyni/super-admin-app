import type { MetadataRoute } from "next";
import { emailTheme } from "@/emails/theme";

/**
 * Installable app ("Add to Home Screen"): owners open their dashboard like an app — needed on
 * iPhone for push notifications (iOS allows web push only for Home Screen apps). Colours are the
 * brand tokens mirrored in emailTheme (no CSS variables here).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Serbi",
    short_name: "Serbi",
    description: "Your café: menu, tables, website and live orders.",
    start_url: "/auth/home",
    scope: "/",
    display: "standalone",
    background_color: emailTheme.color.page,
    theme_color: emailTheme.color.primary,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
