/*
 * Content languages (menu, website texts). Same list as platform.content_languages() in the
 * database. EN/FR/AR are available to every café; the others only when the Serbi admin adds them.
 * Names are static (not Intl) so server and browser render the same text.
 */

export const CONTENT_LANGUAGES = {
  en: { name: "English", names: { fr: "Anglais", ar: "الإنجليزية" }, native: "English" },
  fr: { name: "French", names: { fr: "Français", ar: "الفرنسية" }, native: "Français" },
  ar: { name: "Arabic", names: { fr: "Arabe", ar: "العربية" }, native: "العربية" },
  es: { name: "Spanish", names: { fr: "Espagnol", ar: "الإسبانية" }, native: "Español" },
  it: { name: "Italian", names: { fr: "Italien", ar: "الإيطالية" }, native: "Italiano" },
  de: { name: "German", names: { fr: "Allemand", ar: "الألمانية" }, native: "Deutsch" },
  tr: { name: "Turkish", names: { fr: "Turc", ar: "التركية" }, native: "Türkçe" },
  pt: { name: "Portuguese", names: { fr: "Portugais", ar: "البرتغالية" }, native: "Português" },
  ru: { name: "Russian", names: { fr: "Russe", ar: "الروسية" }, native: "Русский" },
  zh: { name: "Chinese", names: { fr: "Chinois", ar: "الصينية" }, native: "中文" },
  nl: { name: "Dutch", names: { fr: "Néerlandais", ar: "الهولندية" }, native: "Nederlands" },
  ja: { name: "Japanese", names: { fr: "Japonais", ar: "اليابانية" }, native: "日本語" },
} as const;

export type ContentLanguage = keyof typeof CONTENT_LANGUAGES;
export const BASE_LANGUAGES: readonly ContentLanguage[] = ["en", "fr", "ar"];
export const isContentLanguage = (v: unknown): v is ContentLanguage =>
  typeof v === "string" && v in CONTENT_LANGUAGES;

/**
 * "French (Français)" in the interface language `ui` ("Anglais (English)", "الفرنسية (Français)"),
 * or just the name when both are the same.
 */
export function languageLabel(code: string, ui: string = "en"): string {
  if (!isContentLanguage(code)) return code;
  const l = CONTENT_LANGUAGES[code];
  const name = ui === "fr" || ui === "ar" ? l.names[ui] : l.name;
  return name === l.native ? name : `${name} (${l.native})`;
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
