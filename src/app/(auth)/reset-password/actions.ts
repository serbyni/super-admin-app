"use server";

import { redirect } from "next/navigation";
import { fieldErrors, newPasswordSchema } from "@/lib/auth/register-schema";
import { serverApi } from "@/lib/data/server-api";

export type ResetState = {
  errors?: { password?: string; confirmPassword?: string; form?: string };
};

const AUTH_ERRORS: Record<string, string> = {
  same_password: "Choose a password different from your current one.",
  weak_password: "This password is too weak or has appeared in a data breach. Choose another.",
  session_not_found: "Your reset link has expired. Request a new one.",
};

/** Sets the new password, signs out everywhere, then shows the success page. */
export async function resetPassword(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const parsed = newPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) as ResetState["errors"] };

  const api = serverApi();
  if (!(await api.auth.currentUser())) redirect("/forgot-password?error=link_expired");

  const result = await api.auth.updatePassword(parsed.data.password);
  if (!result.ok) {
    const message = AUTH_ERRORS[result.code] ?? "Could not change the password. Please try again.";
    return { errors: result.code === "same_password" ? { password: message } : { form: message } };
  }
  await api.auth.signOutEverywhere();
  redirect("/reset-password/success");
}
