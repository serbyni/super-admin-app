"use server";

import { revalidatePath } from "next/cache";
import { requireTenantOwner } from "@/lib/auth/guards";
import { tenantDashboard } from "@/lib/auth/routes";
import { inputField, isDataError } from "@/lib/data/errors";
import { serverApi } from "@/lib/data/server-api";
import {
  cafeSettingsSchema,
  emailChangeSchema,
  passwordChangeSchema,
  profileSchema,
  zodErrors,
  type FormState,
} from "@/lib/settings/schema";

const values = (f: FormData) => Object.fromEntries(f) as Record<string, string>;
const done = (prev: FormState, message: string): FormState => ({
  ok: true,
  saved: (prev.saved ?? 0) + 1,
  message,
});

/** Café tab. Only the café's owner (checked here and again in update_my_cafe). */
export async function saveCafeAction(
  slug: string,
  prev: FormState,
  form: FormData,
): Promise<FormState> {
  await requireTenantOwner(slug);
  const parsed = cafeSettingsSchema.safeParse(values(form));
  if (!parsed.success) return { errors: zodErrors(parsed.error) };
  const d = parsed.data;
  try {
    await serverApi().cafes.updateMine(slug, {
      name: d.name,
      countryCode: d.country_code,
      city: d.city,
      address: d.address || undefined,
      currency: d.currency,
      timezone: d.timezone,
      locale: d.locale,
      seed: d.seed,
      phone: d.phone,
      email: d.email,
      facebook: d.facebook,
      instagram: d.instagram,
    });
  } catch (e) {
    const field = inputField(e);
    if (field) return { errors: { [field]: "Please check this value." } };
    if (isDataError(e)) return { errors: { form: "Could not save. Please try again." } };
    throw e;
  }
  revalidatePath(tenantDashboard(slug), "layout");
  return done(prev, "Café settings saved");
}

/** Profile tab: name + phone. */
export async function saveProfileAction(
  slug: string,
  prev: FormState,
  form: FormData,
): Promise<FormState> {
  await requireTenantOwner(slug);
  const parsed = profileSchema.safeParse(values(form));
  if (!parsed.success) return { errors: zodErrors(parsed.error) };
  try {
    await serverApi().owners.updateProfile({
      fullName: parsed.data.full_name,
      phone: parsed.data.phone,
    });
  } catch (e) {
    const field = inputField(e);
    if (field) return { errors: { [field]: "Please check this value." } };
    if (isDataError(e)) return { errors: { form: "Could not save. Please try again." } };
    throw e;
  }
  revalidatePath(tenantDashboard(slug), "layout");
  return done(prev, "Profile saved");
}

const EMAIL_ERRORS: Record<string, string> = {
  email_exists: "This email is already used by another account.",
  email_address_invalid: "This email address is not accepted. Try another one.",
  over_email_send_rate_limit: "Too many emails sent. Wait a few minutes and try again.",
};

/** Sign-in email: Supabase sends the confirmation link(s); nothing changes until confirmed. */
export async function changeEmailAction(
  slug: string,
  prev: FormState,
  form: FormData,
): Promise<FormState> {
  const { user } = await requireTenantOwner(slug);
  const parsed = emailChangeSchema.safeParse(values(form));
  if (!parsed.success) return { errors: zodErrors(parsed.error) };
  if (parsed.data.email === user.email?.toLowerCase()) {
    return { errors: { email: "This is already your sign-in email." } };
  }
  const r = await serverApi().auth.requestEmailChange(parsed.data.email);
  if (!r.ok) {
    return { errors: { email: EMAIL_ERRORS[r.code] ?? "Could not start the change. Try again." } };
  }
  revalidatePath(tenantDashboard(slug), "layout");
  return done(
    prev,
    `Check ${parsed.data.email} (and your current inbox) for the confirmation link.`,
  );
}

const PASSWORD_ERRORS: Record<string, string> = {
  same_password: "Choose a password different from the current one.",
  weak_password: "This password is too weak or has appeared in a data breach. Choose another.",
  reauthentication_needed: "Please sign in again, then change your password.",
};

/** Password: checks the current one, sets the new one, signs out the other devices. */
export async function changePasswordAction(
  slug: string,
  prev: FormState,
  form: FormData,
): Promise<FormState> {
  await requireTenantOwner(slug);
  const parsed = passwordChangeSchema.safeParse(values(form));
  if (!parsed.success) return { errors: zodErrors(parsed.error) };
  const r = await serverApi().auth.changePassword(
    parsed.data.current_password,
    parsed.data.password,
  );
  if (!r.ok) {
    if (r.code === "invalid_current_password") {
      return { errors: { current_password: "The current password is not correct." } };
    }
    return { errors: { form: PASSWORD_ERRORS[r.code] ?? "Could not change the password." } };
  }
  return done(prev, "Password changed. Other devices were signed out.");
}
