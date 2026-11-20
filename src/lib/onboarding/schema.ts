import { z } from "zod";
import { msg } from "@/i18n/msg";
import { cafeContactSchema } from "@/lib/cafes/contact";
import { slugSchema } from "@/lib/cafes/slug";

/*
 * Wizard validation (server actions). The database re-checks everything in provision_cafe.
 */

const timezones: ReadonlySet<string> = new Set(Intl.supportedValuesOf("timeZone"));

export const detailsSchema = z.object({
  name: z.string().trim().min(2, msg("cafeNameLength")).max(80),
  country_code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, msg("countryRequired")),
  city: z.string().trim().min(1, msg("cityRequired")).max(80),
  address: z.string().trim().max(300).optional().or(z.literal("")),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, msg("currencyRequired")),
  timezone: z.string().refine((tz) => timezones.has(tz), msg("timezoneRequired")),
  locale: z.enum(["en", "fr", "ar"], { error: msg("localeRequired") }),
});
export type DetailsInput = z.infer<typeof detailsSchema>;

/** Step 2: how customers reach the café (phone + email required, social pages optional). */
export const contactSchema = cafeContactSchema;
export type ContactInput = z.infer<typeof contactSchema>;

export const addressSchema = z.object({ slug: slugSchema });

export const lookSchema = z.object({
  seed: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^#[0-9a-f]{6}$/, msg("colourRequired")),
});

export const agreementSchema = z.object({
  terms: z.literal(true, { error: msg("termsOfServiceRequired") }),
  dpa: z.literal(true, { error: msg("dpaRequired") }),
});

/** Everything provision_cafe needs (the review step re-validates the whole draft). */
export const createCafeSchema = detailsSchema
  .and(contactSchema)
  .and(addressSchema)
  .and(lookSchema)
  .and(agreementSchema);
export type CreateCafeInput = z.infer<typeof createCafeSchema>;

export type WizardDraft = Partial<
  DetailsInput & ContactInput & { slug: string; seed: string; terms: boolean; dpa: boolean }
>;

/**
 * Steps: 1 details · 2 contact · 3 address · 4 look · 5 agreement · 6 review
 * (7 = done, after creation).
 */
export const WIZARD_STEPS = [
  { step: 1, key: "details", label: "Café details" },
  { step: 2, key: "contact", label: "Contact" },
  { step: 3, key: "address", label: "Café address" },
  { step: 4, key: "look", label: "Look" },
  { step: 5, key: "agreement", label: "Agreement" },
  { step: 6, key: "review", label: "Review" },
] as const;
export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;
export const REVIEW_STEP: WizardStep = 6;

/** Wizard step owning each field (to jump back to the first invalid one). */
export const FIELD_STEP: Record<string, WizardStep> = {
  name: 1,
  country_code: 1,
  city: 1,
  address: 1,
  currency: 1,
  timezone: 1,
  locale: 1,
  phone: 2,
  email: 2,
  facebook: 2,
  instagram: 2,
  slug: 3,
  seed: 4,
  terms: 5,
  dpa: 5,
};
