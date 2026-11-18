import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import { z } from "zod";
import { PASSWORD_MIN_LENGTH } from "./password-strength";

const trimmed = (min: number, max: number, message: string) =>
  z.string().trim().min(min, message).max(max, message);

/**
 * International number (the form submits E.164 from the country picker). Validated with the full
 * libphonenumber rules for that country and normalised to E.164, e.g. "+216 20 123 456" → "+21620123456".
 */
const phone = z.string().transform((v, ctx) => {
  const parsed = parsePhoneNumberFromString(v.replace(/[\s().-]/g, ""));
  if (!v.trim().startsWith("+") || !parsed) {
    ctx.addIssue({ code: "custom", message: "Choose your country and enter your phone number" });
    return z.NEVER;
  }
  if (!parsed.isValid()) {
    ctx.addIssue({ code: "custom", message: "This number is not valid for the selected country" });
    return z.NEVER;
  }
  return parsed.number;
});

/** Business details (shared by email sign-up and the social "complete profile" step). */
export const businessProfileSchema = z.object({
  fullName: trimmed(2, 80, "Enter your full name (2–80 characters)"),
  phone,
  businessName: trimmed(2, 80, "Enter your business name (2–80 characters)"),
  // Checked against the active list (managed by super admins) in the server action.
  businessType: z.string().regex(/^[a-z][a-z0-9_]{1,30}$/, "Choose a business type"),
  terms: z.literal("on", { error: "You must accept the Terms and Privacy Policy" }),
});

/** Password rules (register + reset): 10–72 chars with upper-case, digit and symbol. */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(72, "Use at most 72 characters")
  .regex(/[A-Z]/, "Add an upper-case letter")
  .regex(/[0-9]/, "Add a digit")
  .regex(/[^A-Za-z0-9]/, "Add a symbol");

/** New password + confirmation (reset password). */
export const newPasswordSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export const registerSchema = businessProfileSchema
  .extend({
    email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type FieldErrors = Partial<
  Record<
    keyof RegisterInput | "form" | "location" | "street" | "postal_code" | "city" | "country_code",
    string
  >
>;

/** First error message per field, for showing under inputs. */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = (issue.path[0] ?? "form") as keyof FieldErrors;
    out[key] ??= issue.message;
  }
  return out;
}
