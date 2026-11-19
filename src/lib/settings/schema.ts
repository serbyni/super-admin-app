import { z } from "zod";
import { passwordSchema, phoneSchema } from "@/lib/auth/register-schema";
import { cafeContactSchema } from "@/lib/cafes/contact";
import { detailsSchema, lookSchema } from "@/lib/onboarding/schema";

/** Café tab: same rules as onboarding (details + contact + colour). The address is fixed. */
export const cafeSettingsSchema = detailsSchema.and(cafeContactSchema).and(lookSchema);
export type CafeSettings = z.infer<typeof cafeSettingsSchema>;

/** Profile tab: the owner's own name and phone. */
export const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name (2–80 characters)").max(80),
  phone: phoneSchema,
});

export const emailChangeSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")),
});

export const passwordChangeSchema = z
  .object({
    current_password: z.string().min(1, "Enter your current password"),
    password: passwordSchema,
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, {
    path: ["confirm_password"],
    message: "Passwords do not match",
  })
  .refine((d) => d.password !== d.current_password, {
    path: ["password"],
    message: "Choose a password different from the current one",
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
