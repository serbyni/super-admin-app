import { argbFromHex, hexFromArgb, themeFromSourceColor } from "@material/material-color-utilities";
import { DEFAULT_BRAND_SEED } from "@/config/cafe-defaults";
import type { Json } from "@/lib/supabase/database.types";

const HEX = /^#[0-9a-f]{6}$/;

/** Brand seed colour stored in cafes.theme ({ seed: "#rrggbb" }), or the default. */
export function themeSeed(theme: Json | null | undefined): string {
  const seed = theme && typeof theme === "object" && !Array.isArray(theme) ? theme.seed : undefined;
  return typeof seed === "string" && HEX.test(seed) ? seed : DEFAULT_BRAND_SEED;
}

export type CafePalette = {
  primary: string;
  onPrimary: string;
  container: string;
  onContainer: string;
  surface: string;
  onSurface: string;
  variant: string;
  onVariant: string;
};

/** Material 3 light scheme generated from one brand colour (same as the onboarding preview). */
export function cafePalette(seed: string): CafePalette {
  const s = themeFromSourceColor(argbFromHex(HEX.test(seed) ? seed : DEFAULT_BRAND_SEED)).schemes
    .light;
  return {
    primary: hexFromArgb(s.primary),
    onPrimary: hexFromArgb(s.onPrimary),
    container: hexFromArgb(s.primaryContainer),
    onContainer: hexFromArgb(s.onPrimaryContainer),
    surface: hexFromArgb(s.surface),
    onSurface: hexFromArgb(s.onSurface),
    variant: hexFromArgb(s.surfaceVariant),
    onVariant: hexFromArgb(s.onSurfaceVariant),
  };
}
