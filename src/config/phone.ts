import type { CountryCode } from "libphonenumber-js";

/** Country selected in the phone field before the owner picks one. */
export const DEFAULT_PHONE_COUNTRY: CountryCode = "TN";

/** Shown at the top of the country list (main markets first). */
export const PREFERRED_PHONE_COUNTRIES: CountryCode[] = ["TN", "DZ", "LY", "MA", "FR"];
