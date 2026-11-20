/** Time zone used to show dates in the platform/admin UI (main market). */
export const PLATFORM_TIME_ZONE = "Africa/Tunis";

/** Date formatting locale per interface language (ar-TN: Arabic with Latin digits). */
const FORMAT_LOCALE: Record<string, string> = { en: "en-GB", fr: "fr-FR", ar: "ar-TN" };

const formatters = new Map<string, Intl.DateTimeFormat>();

/** "20 Nov 2026, 12:30" (in the interface language `locale`, default English). */
export function formatDateTime(iso: string | null | undefined, locale: string = "en"): string {
  if (!iso) return "—";
  const key = FORMAT_LOCALE[locale] ?? FORMAT_LOCALE.en;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(key, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: PLATFORM_TIME_ZONE,
    });
    formatters.set(key, f);
  }
  return f.format(new Date(iso));
}
