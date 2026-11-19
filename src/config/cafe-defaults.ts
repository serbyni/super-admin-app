/** Defaults offered in the onboarding wizard (owners can change them). */

export type CurrencyCode = string;

/** Currency suggested for the café's country (ISO 4217). */
export const CURRENCY_BY_COUNTRY: Record<string, CurrencyCode> = {
  TN: "TND",
  DZ: "DZD",
  MA: "MAD",
  LY: "LYD",
  EG: "EGP",
  FR: "EUR",
  BE: "EUR",
  DE: "EUR",
  IT: "EUR",
  ES: "EUR",
  CH: "CHF",
  GB: "GBP",
  US: "USD",
  CA: "CAD",
  AE: "AED",
  SA: "SAR",
  QA: "QAR",
};

/** Currencies offered in the picker (main markets first). */
export const CURRENCIES: CurrencyCode[] = [
  "TND",
  "EUR",
  "DZD",
  "MAD",
  "LYD",
  "EGP",
  "USD",
  "GBP",
  "CHF",
  "CAD",
  "AED",
  "SAR",
  "QAR",
];

/** Time zone suggested for the café's country (IANA). */
export const TIMEZONE_BY_COUNTRY: Record<string, string> = {
  TN: "Africa/Tunis",
  DZ: "Africa/Algiers",
  MA: "Africa/Casablanca",
  LY: "Africa/Tripoli",
  EG: "Africa/Cairo",
  FR: "Europe/Paris",
  BE: "Europe/Brussels",
  DE: "Europe/Berlin",
  IT: "Europe/Rome",
  ES: "Europe/Madrid",
  CH: "Europe/Zurich",
  GB: "Europe/London",
  AE: "Asia/Dubai",
  SA: "Asia/Riyadh",
  QA: "Asia/Qatar",
};

export const FALLBACK_CURRENCY: CurrencyCode = "EUR";
export const FALLBACK_TIMEZONE = "UTC";

/** Brand colour presets for step 3 (from the Serbi palettes; owners may pick any colour). */
export const BRAND_PRESETS: { name: string; seed: string }[] = [
  { name: "Espresso", seed: "#6f4e37" },
  { name: "Terracotta", seed: "#b5562f" },
  { name: "Olive", seed: "#5b6b2f" },
  { name: "Sage", seed: "#3e7a3d" },
  { name: "Teal", seed: "#24434b" },
  { name: "Ocean", seed: "#2f6fdb" },
  { name: "Plum", seed: "#6b3a5b" },
  { name: "Charcoal", seed: "#34302d" },
];

export const DEFAULT_BRAND_SEED = BRAND_PRESETS[0].seed;

export const CAFE_LOCALES = [
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
  { value: "ar", label: "العربية" },
] as const;
export type CafeLocale = (typeof CAFE_LOCALES)[number]["value"];
