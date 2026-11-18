import { z } from "zod";
import { slugSchema } from "@/lib/cafes/slug";

/*
 * Wizard validation (server actions). The database re-checks everything in provision_cafe.
 */

const timezones: ReadonlySet<string> = new Set(Intl.supportedValuesOf("timeZone"));

export const detailsSchema = z.object({
  name: z.string().trim().min(2, "Enter the café name (2–80 characters)").max(80),
  country_code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "Choose the country"),
  city: z.string().trim().min(1, "Enter the city").max(80),
  address: z.string().trim().max(300).optional().or(z.literal("")),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Choose the currency"),
  timezone: z.string().refine((tz) => timezones.has(tz), "Choose the time zone"),
  locale: z.enum(["en", "fr", "ar"], { error: "Choose the default language" }),
});
export type DetailsInput = z.infer<typeof detailsSchema>;

export const addressSchema = z.object({ slug: slugSchema });

export const lookSchema = z.object({
  seed: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^#[0-9a-f]{6}$/, "Choose a colour"),
});

export const agreementSchema = z.object({
  terms: z.literal(true, { error: "Accept the Terms of Service" }),
  dpa: z.literal(true, { error: "Accept the Data Processing Agreement" }),
});

/** Everything provision_cafe needs (the review step re-validates the whole draft). */
export const createCafeSchema = detailsSchema
  .and(addressSchema)
  .and(lookSchema)
  .and(agreementSchema);
export type CreateCafeInput = z.infer<typeof createCafeSchema>;

export type WizardDraft = Partial<
  DetailsInput & { slug: string; seed: string; terms: boolean; dpa: boolean }
>;

/** Steps: 1 details · 2 address · 3 look · 4 agreement · 5 review (6 = done, after creation). */
export const WIZARD_STEPS = [
  { step: 1, key: "details", label: "Café details" },
  { step: 2, key: "address", label: "Café address" },
  { step: 3, key: "look", label: "Look" },
  { step: 4, key: "agreement", label: "Agreement" },
  { step: 5, key: "review", label: "Review" },
] as const;
export type WizardStep = 1 | 2 | 3 | 4 | 5;
