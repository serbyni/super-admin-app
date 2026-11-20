/*
 * Languages of the owner side (dashboard, sign-in, onboarding). The super-admin console stays
 * in English. Signed in: the owner's choice (Settings → Profile, stored on the account, also
 * used for e-mails). Signed out: the language picked on the sign-in pages (cookie), else the
 * phone/browser language, else English.
 */

export const UI_LOCALES = ["en", "fr", "ar"] as const;
export type UiLocale = (typeof UI_LOCALES)[number];
export const DEFAULT_UI_LOCALE: UiLocale = "en";

/** Cookie holding the language picked before signing in (sign-in / register pages). */
export const UI_LANG_COOKIE = "serbi_ui_lang";
export const UI_LANG_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Names shown in language pickers, in their own language. */
export const UI_LANGUAGE_NAMES: Record<UiLocale, string> = {
  en: "English",
  fr: "Français",
  ar: "العربية",
};

export const isUiLocale = (v: unknown): v is UiLocale =>
  typeof v === "string" && (UI_LOCALES as readonly string[]).includes(v);

export const isRtl = (locale: string) => ["ar", "he", "fa", "ur"].includes(locale.split("-")[0]);

/** Base languages of an Accept-Language header, best first ("fr-FR,en;q=0.8" → ["fr", "en"]). */
export function acceptedLanguages(header: string | null | undefined): string[] {
  if (!header) return [];
  return header
    .split(",")
    .map((part, i) => {
      const [tag, ...params] = part.trim().split(";");
      const q = Number(
        params
          .find((p) => p.trim().startsWith("q="))
          ?.trim()
          .slice(2) ?? "1",
      );
      return { lang: tag.trim().toLowerCase().split("-")[0], q: Number.isNaN(q) ? 0 : q, i };
    })
    .filter((x) => x.lang && x.lang !== "*" && x.q > 0)
    .sort((a, b) => b.q - a.q || a.i - b.i)
    .map((x) => x.lang);
}

/** The interface language: saved choice (account or cookie) → browser language → English. */
export function pickUiLocale(input: {
  saved: string | null | undefined;
  acceptLanguage: string | null | undefined;
}): UiLocale {
  if (isUiLocale(input.saved)) return input.saved;
  return acceptedLanguages(input.acceptLanguage).find(isUiLocale) ?? DEFAULT_UI_LOCALE;
}
