"use server";

import { redirect } from "next/navigation";
import { fieldErrors, newPasswordSchema } from "@/lib/auth/register-schema";
import { msg } from "@/i18n/msg";
import { serverApi } from "@/lib/data/server-api";

export type ResetState = {
  errors?: { password?: string; confirmPassword?: string; form?: string };
};

const AUTH_ERRORS: Record<string, string> = {
  same_password: msg("resetSamePassword"),
  weak_password: msg("passwordWeak"),
  session_not_found: msg("resetExpired"),
};

/** Sets the new password, signs out everywhere, then shows the success page. */
export async function resetPassword(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const parsed = newPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) as ResetState["errors"] };

  const api = serverApi();
  if (!(await api.auth.currentUser())) redirect("/forgot-password?error=link_expired");

  const result = await api.auth.updatePassword(parsed.data.password);
  if (!result.ok) {
    const message = AUTH_ERRORS[result.code] ?? msg("resetFailed");
    return { errors: result.code === "same_password" ? { password: message } : { form: message } };
  }
  await api.auth.signOutEverywhere();
  redirect("/reset-password/success");
}
