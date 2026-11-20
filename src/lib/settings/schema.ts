import { z } from "zod";
import { msg } from "@/i18n/msg";
import { passwordSchema, phoneSchema } from "@/lib/auth/register-schema";
import { cafeContactSchema } from "@/lib/cafes/contact";
import { detailsSchema, lookSchema } from "@/lib/onboarding/schema";

/** Café tab: same rules as onboarding (details + contact + colour). The address is fixed. */
export const cafeSettingsSchema = detailsSchema.and(cafeContactSchema).and(lookSchema);
export type CafeSettings = z.infer<typeof cafeSettingsSchema>;

/** Profile tab: the owner's own name and phone. */
export const profileSchema = z.object({
  full_name: z.string().trim().min(2, msg("fullNameLength")).max(80),
  phone: phoneSchema,
});

export const emailChangeSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email(msg("emailInvalid"))),
});

export const passwordChangeSchema = z
  .object({
    current_password: z.string().min(1, msg("currentPasswordRequired")),
    password: passwordSchema,
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, {
    path: ["confirm_password"],
    message: msg("passwordsMismatch"),
  })
  .refine((d) => d.password !== d.current_password, {
    path: ["password"],
    message: msg("passwordSameAsCurrent"),
  });

/** Result of every settings form (useActionState). */
export type FormState = {
  ok?: boolean;
  /** Increments on every successful save (lets the form show one toast per save). */
  saved?: number;
  message?: string;
  errors?: Record<string, string>;
};

export function zodErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of error.issues) out[String(i.path[0] ?? "form")] ??= i.message;
  return out;
}
