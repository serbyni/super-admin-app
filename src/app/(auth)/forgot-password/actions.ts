"use server";

import { z } from "zod";
import { serverApi } from "@/lib/data/server-api";

export type ForgotState = { sent?: boolean; email?: string; error?: string };

const email = z.string().trim().toLowerCase().pipe(z.email());

/**
 * Sends the reset email. The answer is the same whether or not the account exists
 * (no account enumeration); only rate limits are reported.
 */
export async function requestPasswordReset(
  _prev: ForgotState,
  formData: FormData,
): Promise<ForgotState> {
  const parsed = email.safeParse(formData.get("email"));
  if (!parsed.success) return { error: "Enter a valid email address." };
  const result = await serverApi().auth.requestPasswordReset(parsed.data);
  if (!result.ok && /rate_limit/.test(result.code)) {
    return {
      email: parsed.data,
      error: "Too many requests. Please wait a minute before asking for another link.",
    };
  }
  if (!result.ok) console.error("[auth] resetPasswordForEmail failed:", result.code);
  return { sent: true, email: parsed.data };
}
