import { z } from "zod";
import { PASSWORD_MIN_LENGTH } from "./password-strength";

export const BUSINESS_TYPES = ["cafe", "restaurant", "bakery", "other"] as const;

const trimmed = (min: number, max: number, message: string) =>
  z.string().trim().min(min, message).max(max, message);

/** Normalises "+216 20 000 000" → "+21620000000" and requires E.164. */
const phone = z
  .string()
  .transform((v) => v.replace(/[\s().-]/g, ""))
  .pipe(
    z
      .string()
      .regex(/^\+[1-9][0-9]{6,14}$/, "Enter the number with country code, e.g. +216 20 000 000"),
  );

/** Business details (shared by email sign-up and the social "complete profile" step). */
export const businessProfileSchema = z.object({
  fullName: trimmed(2, 80, "Enter your full name (2–80 characters)"),
  phone,
  businessName: trimmed(2, 80, "Enter your business name (2–80 characters)"),
  businessType: z.enum(BUSINESS_TYPES, { error: "Choose a business type" }),
  country: trimmed(2, 60, "Enter your country"),
  city: trimmed(1, 80, "Enter your city"),
  terms: z.literal("on", { error: "You must accept the Terms and Privacy Policy" }),
});

export const registerSchema = businessProfileSchema
  .extend({
    email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")),
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
      .max(72, "Use at most 72 characters")
      .regex(/[A-Z]/, "Add an upper-case letter")
      .regex(/[0-9]/, "Add a digit")
      .regex(/[^A-Za-z0-9]/, "Add a symbol"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type FieldErrors = Partial<Record<keyof RegisterInput | "form", string>>;

/** First error message per field, for showing under inputs. */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = (issue.path[0] ?? "form") as keyof FieldErrors;
    out[key] ??= issue.message;
  }
  return out;
}
