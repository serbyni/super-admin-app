/**
 * Email palette and type. Email clients do not support CSS variables or Tailwind, so the
 * brand tokens from src/app/globals.css (Stitch "Artisanal Brew" roles) are mirrored here —
 * keep them in sync.
 */
export const emailTheme = {
  font: "'Plus Jakarta Sans', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  mono: "'SFMono-Regular', Menlo, Consolas, 'Courier New', monospace",
  color: {
    primary: "#553722", // --sb-primary
    onPrimary: "#ffffff",
    primaryContainer: "#6f4e37", // --sb-primary-container
    primaryFixed: "#ffdcc6", // --sb-primary-fixed
    secondary: "#6d5b4f", // --sb-secondary
    secondaryContainer: "#f7decf", // --sb-secondary-container
    onSecondaryContainer: "#736155",
    tertiary: "#24434b", // --sb-tertiary
    tertiaryFixed: "#c8e8f3",
    page: "#fff8f5", // --sb-surface
    surface: "#ffffff", // --sb-surface-container-lowest
    surfaceLow: "#fbf2ee", // --sb-surface-container-low
    surfaceContainer: "#f5ece8", // --sb-surface-container
    surfaceHigh: "#efe6e3", // --sb-surface-container-high
    surfaceHighest: "#e9e1dd",
    text: "#1e1b19", // --sb-on-surface
    textMuted: "#50453e", // --sb-on-surface-variant
    outlineVariant: "#d4c3ba",
    success: "#3e7a3d", // --sb-success
    successContainer: "#d4f0cf",
    error: "#ba1a1a", // --sb-error
    errorContainer: "#ffdad6",
    onErrorContainer: "#93000a",
  },
  radius: { card: "12px", inner: "8px", pill: "999px" },
} as const;
