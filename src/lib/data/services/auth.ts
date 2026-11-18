import "server-only";
import type { EmailOtpType, User } from "@supabase/supabase-js";
import { pathForStatus } from "@/lib/auth/owner-status";
import { isAdminPath, ROUTES, safeNext, tenantDashboard, tenantSlugOf } from "@/lib/auth/routes";
import { siteUrl } from "@/lib/env";
import type { AuthResult, LazyDb } from "../types";
import type { AdminsService } from "./admins";
import type { OwnersService } from "./owners";

export class AuthService {
  constructor(
    private readonly db: LazyDb,
    private readonly admins: AdminsService,
    private readonly owners: OwnersService,
  ) {}

  /** Signed-in user (verified with the Auth server), or null. */
  async currentUser(): Promise<User | null> {
    const { data } = await (await this.db()).auth.getUser();
    return data.user;
  }

  async signInWithPassword(email: string, password: string): Promise<AuthResult> {
    const { error } = await (await this.db()).auth.signInWithPassword({ email, password });
    return error ? { ok: false, code: error.code ?? "unknown" } : { ok: true };
  }

  /** Finish an email link (token_hash) or OAuth/PKCE redirect (code). False when invalid. */
  async completeRedirect(params: {
    tokenHash: string | null;
    type: EmailOtpType | null;
    code: string | null;
  }): Promise<boolean> {
    if (params.tokenHash && params.type) {
      const { error } = await (
        await this.db()
      ).auth.verifyOtp({
        token_hash: params.tokenHash,
        type: params.type,
      });
      return !error;
    }
    if (params.code)
      return !(await (await this.db()).auth.exchangeCodeForSession(params.code)).error;
    return false;
  }

  /**
   * True when `user` just came in through Google/Facebook WITHOUT a Serbi registration: the
   * account is not linked to an email sign-up, is not a super admin and has no completed owner
   * profile. Owners must register with email first (business details + location); after that,
   * signing in with a provider using the same email works (Supabase links the identities).
   */
  async isUnregisteredOAuthUser(user: User): Promise<boolean> {
    const providers = (user.identities ?? []).map((i) => i.provider);
    const viaEmail = user.app_metadata?.provider === "email" || providers.includes("email");
    if (viaEmail) return false;
    if (await this.admins.isPlatformAdmin()) return false;
    const me = await this.owners.me();
    return me === null || me.status === "profile_incomplete";
  }

  /** Sends the reset email (Supabase "Reset password" template → /auth/reset). */
  async requestPasswordReset(email: string): Promise<AuthResult> {
    const { error } = await (
      await this.db()
    ).auth.resetPasswordForEmail(email, {
      redirectTo: siteUrl("/auth/reset"),
    });
    return error ? { ok: false, code: error.code ?? "unknown" } : { ok: true };
  }

  /** Recovery link (token_hash + type=recovery, or PKCE code) → recovery session. */
  async completeRecovery(params: {
    tokenHash: string | null;
    code: string | null;
  }): Promise<boolean> {
    const db = await this.db();
    if (params.tokenHash) {
      return !(await db.auth.verifyOtp({ token_hash: params.tokenHash, type: "recovery" })).error;
    }
    if (params.code) return !(await db.auth.exchangeCodeForSession(params.code)).error;
    return false;
  }

  /** Change the signed-in user's password. */
  async updatePassword(password: string): Promise<AuthResult> {
    const { error } = await (await this.db()).auth.updateUser({ password });
    return error ? { ok: false, code: error.code ?? "unknown" } : { ok: true };
  }

  /** Sign out on every device (after a password change). */
  async signOutEverywhere(): Promise<void> {
    await (await this.db()).auth.signOut({ scope: "global" });
  }

  async signOut(): Promise<void> {
    await (await this.db()).auth.signOut();
  }

  /**
   * Where the signed-in user belongs — the single rule used by login, the email/OAuth callback,
   * /auth/home and the route guards:
   *   super admin            → `next` when it is an /admin page, else /admin
   *   active owner with café → `next` when it is inside their café, else /<slug>/dashboard
   *   any other owner state  → its status page (complete profile, check email, pending, onboarding)
   */
  async homePath(next?: string | null): Promise<string> {
    const target = safeNext(next);
    if (await this.admins.isPlatformAdmin()) {
      return target && isAdminPath(target) ? target : ROUTES.adminHome;
    }
    const me = await this.owners.me();
    if (me?.status === "active" && me.cafeSlug) {
      return target && tenantSlugOf(target) === me.cafeSlug ? target : tenantDashboard(me.cafeSlug);
    }
    return pathForStatus(me?.status ?? null);
  }
}
