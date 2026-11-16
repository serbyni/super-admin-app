import "server-only";
import { TERMS_VERSION } from "@/config/legal";
import { isOwnerStatus, type OwnerStatus } from "@/lib/auth/owner-status";
import { siteUrl } from "@/lib/env";
import type { BusinessLocation } from "@/lib/location/address";
import { createClient } from "@/lib/supabase/server";
import { unwrap } from "./errors";

/** Owner status of the signed-in user, or null (signed out or not an owner). */
export async function getMyOwnerStatus(): Promise<OwnerStatus | null> {
  const db = await createClient();
  const status = unwrap("get_my_owner_status", await db.rpc("get_my_owner_status"));
  return isOwnerStatus(status) ? status : null;
}

export type OwnerProfile = {
  fullName: string;
  phone: string;
  businessName: string;
  businessType: string;
  location: BusinessLocation;
  locale: string;
};

/** Auth error codes for sign-up / resend that we show a specific message for. */
export type SignUpResult = { ok: true } | { ok: false; code: string };

/** Email sign-up; Supabase sends the verification email. The DB trigger stores the profile. */
export async function signUpOwner(
  input: OwnerProfile & { email: string; password: string },
): Promise<SignUpResult> {
  const db = await createClient();
  const { error } = await db.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: siteUrl("/auth/callback"),
      data: {
        signup_source: "owner",
        full_name: input.fullName,
        phone: input.phone,
        business_name: input.businessName,
        business_type: input.businessType,
        location: input.location,
        locale: input.locale,
        terms_version: TERMS_VERSION,
      },
    },
  });
  return error ? { ok: false, code: error.code ?? "unknown" } : { ok: true };
}

export async function resendSignupEmail(email: string): Promise<SignUpResult> {
  const db = await createClient();
  const { error } = await db.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: siteUrl("/auth/callback") },
  });
  return error ? { ok: false, code: error.code ?? "unknown" } : { ok: true };
}

/**
 * Google/Facebook sign-ups: add business details and submit for review.
 * Throws DataError "not_authenticated" | "profile_already_completed" | "invalid_location".
 */
export async function completeOwnerProfile(input: OwnerProfile): Promise<void> {
  const db = await createClient();
  unwrap(
    "complete_owner_profile",
    await db.rpc("complete_owner_profile", {
      p_full_name: input.fullName,
      p_phone: input.phone,
      p_business_name: input.businessName,
      p_business_type: input.businessType,
      p_location: input.location,
      p_locale: input.locale,
      p_terms_version: TERMS_VERSION,
    }),
  );
}
