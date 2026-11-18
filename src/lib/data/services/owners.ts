import "server-only";
import { TERMS_VERSION } from "@/config/legal";
import { isOwnerStatus, type OwnerStatus } from "@/lib/auth/owner-status";
import { siteUrl } from "@/lib/env";
import type { BusinessLocation } from "@/lib/location/address";
import { unwrap } from "../errors";
import type { AuthResult, LazyDb } from "../types";

export type OwnerProfile = {
  fullName: string;
  phone: string;
  businessName: string;
  businessType: string;
  location: BusinessLocation;
  locale: string;
};

export class OwnersService {
  constructor(private readonly db: LazyDb) {}

  /** Signed-in user's owner status + café slug, or null when not an owner. */
  async me(): Promise<{ status: OwnerStatus; cafeSlug: string | null } | null> {
    const [row] = unwrap("get_my_owner", await (await this.db()).rpc("get_my_owner"));
    return row && isOwnerStatus(row.status)
      ? { status: row.status, cafeSlug: row.cafe_slug }
      : null;
  }

  /** Email sign-up; Supabase sends the verification email. A DB trigger stores the profile. */
  async signUp(input: OwnerProfile & { email: string; password: string }): Promise<AuthResult> {
    const { error } = await (
      await this.db()
    ).auth.signUp({
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

  async resendSignupEmail(email: string): Promise<AuthResult> {
    const { error } = await (
      await this.db()
    ).auth.resend({
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
  async completeProfile(input: OwnerProfile): Promise<void> {
    unwrap(
      "complete_owner_profile",
      await (
        await this.db()
      ).rpc("complete_owner_profile", {
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
}
