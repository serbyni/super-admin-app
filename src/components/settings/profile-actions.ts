"use server";

import { revalidatePath } from "next/cache";
import { isUiLocale } from "@/i18n/config";
import { requireAccountUser } from "@/lib/auth/guards";
import { inputField, isDataError } from "@/lib/data/errors";
import { serverApi } from "@/lib/data/server-api";
import { msg } from "@/i18n/msg";
import {
  emailChangeSchema,
  passwordChangeSchema,
  profileSchema,
  zodErrors,
  type FormState,
} from "@/lib/settings/schema";

/*
 * Profile actions for every account with a dashboard (super admins and active café owners).
 * Each one re-checks the caller; the SQL functions / Supabase Auth only touch the caller's own
 * account, so no id is ever taken from the form.
 */

const values = (f: FormData) => Object.fromEntries(f) as Record<string, string>;
const done = (prev: FormState, message: string): FormState => ({
  ok: true,
  saved: (prev.saved ?? 0) + 1,
  message,
});

export async function saveProfileAction(prev: FormState, form: FormData): Promise<FormState> {
  const { settingsPath } = await requireAccountUser();
  const parsed = profileSchema.safeParse(values(form));
  if (!parsed.success) return { errors: zodErrors(parsed.error) };
  try {
    await serverApi().owners.updateProfile({
      fullName: parsed.data.full_name,
      phone: parsed.data.phone,
    });
  } catch (e) {
    const field = inputField(e);
    if (field) return { errors: { [field]: msg("checkValue") } };
    if (isDataError(e)) return { errors: { form: msg("saveFailed") } };
    throw e;
  }
  revalidatePath(settingsPath);
  return done(prev, msg("profileSaved"));
}

const EMAIL_ERRORS: Record<string, string> = {
  email_exists: msg("emailExists"),
  email_address_invalid: msg("emailNotAccepted"),
  over_email_send_rate_limit: msg("emailRateLimit"),
};

/** Sign-in email: Supabase sends the confirmation link(s); nothing changes until confirmed. */
export async function changeEmailAction(prev: FormState, form: FormData): Promise<FormState> {
  const { user, settingsPath } = await requireAccountUser();
  const parsed = emailChangeSchema.safeParse(values(form));
  if (!parsed.success) return { errors: zodErrors(parsed.error) };
  if (parsed.data.email === user.email?.toLowerCase()) {
    return { errors: { email: msg("emailSame") } };
  }
  const r = await serverApi().auth.requestEmailChange(parsed.data.email);
  if (!r.ok) {
    return { errors: { email: EMAIL_ERRORS[r.code] ?? msg("emailChangeFailed") } };
  }
  revalidatePath(settingsPath);
  return done(prev, msg("emailLinkSent", { email: parsed.data.email }));
}

const PASSWORD_ERRORS: Record<string, string> = {
  same_password: msg("passwordSameAsCurrent"),
  weak_password: msg("passwordWeak"),
  reauthentication_needed: msg("passwordReauth"),
};

/** Password: checks the current one, sets the new one, signs out the other devices. */
export async function changePasswordAction(prev: FormState, form: FormData): Promise<FormState> {
  await requireAccountUser();
  const parsed = passwordChangeSchema.safeParse(values(form));
  if (!parsed.success) return { errors: zodErrors(parsed.error) };
  const r = await serverApi().auth.changePassword(
    parsed.data.current_password,
    parsed.data.password,
  );
  if (!r.ok) {
    if (r.code === "invalid_current_password") {
      return { errors: { current_password: msg("passwordWrong") } };
    }
    return { errors: { form: PASSWORD_ERRORS[r.code] ?? msg("passwordFailed") } };
  }
  return done(prev, msg("passwordChanged"));
}

/** Owners: dashboard (and e-mail) language. The page reloads to show it. */
export async function setUiLanguageAction(
  locale: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { kind, settingsPath } = await requireAccountUser();
  if (kind !== "owner" || !isUiLocale(locale)) return { ok: false, message: msg("checkValue") };
  try {
    await serverApi().owners.setUiLocale(locale);
  } catch (e) {
    if (isDataError(e)) return { ok: false, message: msg("saveFailed") };
    throw e;
  }
  revalidatePath(settingsPath, "layout");
  return { ok: true };
}
