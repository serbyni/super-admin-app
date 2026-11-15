import { z } from "zod";

export const LOCALES = ["en", "fr", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export type LocalizedText = Partial<Record<Locale, string>> & { en: string };

export type BusinessType = { slug: string; name: LocalizedText; icon: string };

export type AdminBusinessType = BusinessType & {
  id: string;
  sort_order: number;
  is_active: boolean;
  owners_count: number;
  updated_at: string;
};

export const BUSINESS_TYPE_SLUG = /^[a-z][a-z0-9_]{1,30}$/;
export const ICON_NAME = /^[a-z0-9_]{2,40}$/;

const optionalName = z
  .string()
  .trim()
  .max(60, "Max 60 characters")
  .transform((v) => (v === "" ? undefined : v));

/** Admin create/edit form. */
export const businessTypeFormSchema = z.object({
  id: z
    .string()
    .optional()
    .transform((v) => (v ? v : null))
    .pipe(z.uuid().nullable()),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      BUSINESS_TYPE_SLUG,
      "Lowercase letters, digits and _ only (2–31 chars, starts with a letter)",
    ),
  name_en: z.string().trim().min(2, "English name is required (2–60 chars)").max(60),
  name_fr: optionalName,
  name_ar: optionalName,
  icon: z.string().trim().regex(ICON_NAME, "Material Symbols name, e.g. local_cafe"),
  sort_order: z.coerce.number().int("Whole number").min(0).max(10000),
  is_active: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
});

export type BusinessTypeForm = z.infer<typeof businessTypeFormSchema>;

export function localizedName(name: LocalizedText, locale: Locale = "en"): string {
  return name[locale] ?? name.en;
}
