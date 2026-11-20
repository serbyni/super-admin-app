/*
 * Content languages (menu, website texts). Same list as platform.content_languages() in the
 * database. EN/FR/AR are available to every café; the others only when the Serbi admin adds them.
 * Names are static (not Intl) so server and browser render the same text.
 */

export const CONTENT_LANGUAGES = {
  en: { name: "English", native: "English" },
  fr: { name: "French", native: "Français" },
  ar: { name: "Arabic", native: "العربية" },
  es: { name: "Spanish", native: "Español" },
  it: { name: "Italian", native: "Italiano" },
  de: { name: "German", native: "Deutsch" },
  tr: { name: "Turkish", native: "Türkçe" },
  pt: { name: "Portuguese", native: "Português" },
  ru: { name: "Russian", native: "Русский" },
  zh: { name: "Chinese", native: "中文" },
  nl: { name: "Dutch", native: "Nederlands" },
  ja: { name: "Japanese", native: "日本語" },
} as const;

export type ContentLanguage = keyof typeof CONTENT_LANGUAGES;
export const BASE_LANGUAGES: readonly ContentLanguage[] = ["en", "fr", "ar"];
export const isContentLanguage = (v: unknown): v is ContentLanguage =>
  typeof v === "string" && v in CONTENT_LANGUAGES;

/** "French (Français)" — or just the name when both are the same. */
export function languageLabel(code: string): string {
  if (!isContentLanguage(code)) return code;
  const l = CONTENT_LANGUAGES[code];
  return l.name === l.native ? l.name : `${l.name} (${l.native})`;
}

export const isRtlLanguage = (code: string) => ["ar", "he", "fa", "ur"].includes(code);

/** Translations of one record: { "en": { "name": "…" } } (empty texts are dropped). */
export type I18n = Partial<Record<string, Record<string, string>>>;

/** Removes empty texts and languages without any text (what is saved). */
export function cleanI18n(i18n: I18n): I18n {
  const out: I18n = {};
  for (const [lang, fields] of Object.entries(i18n)) {
    const kept = Object.fromEntries(
      Object.entries(fields ?? {})
        .map(([k, v]) => [k, (v ?? "").trim()])
        .filter(([, v]) => v),
    );
    if (Object.keys(kept).length) out[lang] = kept;
  }
  return out;
}
