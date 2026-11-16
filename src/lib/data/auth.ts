import "server-only";
import type { EmailOtpType, User } from "@supabase/supabase-js";
import { pathForStatus } from "@/lib/auth/owner-status";
import { createClient } from "@/lib/supabase/server";
import { isPlatformAdmin } from "./admins";
import { getMyOwnerStatus } from "./owners";

/** Signed-in user (verified with the Auth server), or null. */
export async function getCurrentUser(): Promise<User | null> {
  const db = await createClient();
  const { data } = await db.auth.getUser();
  return data.user;
}

export type SignInResult = { ok: true } | { ok: false; code: string };

export async function signInWithPassword(email: string, password: string): Promise<SignInResult> {
  const db = await createClient();
  const { error } = await db.auth.signInWithPassword({ email, password });
  return error ? { ok: false, code: error.code ?? "unknown" } : { ok: true };
}

/** Finish an email link (token_hash) or OAuth/PKCE redirect (code). Returns false when invalid. */
export async function completeAuthRedirect(params: {
  tokenHash: string | null;
  type: EmailOtpType | null;
  code: string | null;
}): Promise<boolean> {
  const db = await createClient();
  if (params.tokenHash && params.type) {
    return !(await db.auth.verifyOtp({ token_hash: params.tokenHash, type: params.type })).error;
  }
  if (params.code) return !(await db.auth.exchangeCodeForSession(params.code)).error;
  return false;
}

export async function signOut(): Promise<void> {
  const db = await createClient();
  await db.auth.signOut();
}

/**
 * Where the signed-in user belongs: super admins → `adminPath` (default /admin),
 * owners → by status (register/complete, check-email, pending…). The single place for this rule.
 */
export async function homePathForCurrentUser(adminPath = "/admin"): Promise<string> {
  if (await isPlatformAdmin()) return adminPath;
  return pathForStatus(await getMyOwnerStatus());
}
