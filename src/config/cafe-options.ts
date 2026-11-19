import { getCountries } from "libphonenumber-js";
import { CURRENCIES } from "@/config/cafe-defaults";

export type SelectOption = { value: string; label: string };
export type CafeFieldOptions = {
  countries: SelectOption[];
  currencies: SelectOption[];
  timezones: SelectOption[];
};

/**
 * Select options for the café forms (onboarding wizard, café settings).
 * Build them ON THE SERVER and pass them to the client form: country/currency names
 * (Intl.DisplayNames) and the time-zone list come from the runtime's ICU data, which differs
 * between Node and browsers — computing them on both sides causes hydration mismatches.
 */
export function cafeFieldOptions(): CafeFieldOptions {
  const countryNames = new Intl.DisplayNames(["en"], { type: "region" });
  const currencyNames = new Intl.DisplayNames(["en"], { type: "currency" });
  return {
    countries: getCountries()
      .map((c) => ({ value: c, label: countryNames.of(c) ?? c }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    currencies: CURRENCIES.map((c) => ({ value: c, label: `${c} — ${currencyNames.of(c) ?? c}` })),
    timezones: Intl.supportedValuesOf("timeZone").map((tz) => ({
      value: tz,
      label: tz.replaceAll("_", " "),
    })),
  };
}

/** Country name from the options list (same text on server and client). */
export function countryLabel(options: CafeFieldOptions, code: string | undefined): string {
  return options.countries.find((c) => c.value === code)?.label ?? code ?? "";
}
