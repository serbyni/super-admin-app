/**
 * Email palette and type. Email clients do not support CSS variables or Tailwind, so the
 * brand tokens from src/app/globals.css are mirrored here (keep them in sync).
 */
export const emailTheme = {
  font: "'Plus Jakarta Sans', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  color: {
    primary: "#553722", // --sb-primary
    onPrimary: "#ffffff",
    primaryContainer: "#6f4e37", // --sb-primary-container
    background: "#fbf2ee", // --sb-surface-container-low
    surface: "#ffffff", // --sb-surface-container-lowest
    text: "#1e1b19", // --sb-on-surface
    textMuted: "#50453e", // --sb-on-surface-variant
    outline: "#e9e1dd", // --sb-surface-container-highest
    success: "#3e7a3d", // --sb-success
    successContainer: "#d4f0cf",
    error: "#ba1a1a", // --sb-error
    errorContainer: "#ffdad6",
  },
  radius: "12px",
} as const;
