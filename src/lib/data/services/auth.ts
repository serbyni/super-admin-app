import "server-only";
import type { EmailOtpType, User } from "@supabase/supabase-js";
import { pathForStatus } from "@/lib/auth/owner-status";
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

  async signOut(): Promise<void> {
    await (await this.db()).auth.signOut();
  }

  /**
   * Where the signed-in user belongs: super admins → `adminPath` (default /admin), owners → by
   * status (register/complete, check-email, pending…). The single place for this rule.
   */
  async homePath(adminPath = "/admin"): Promise<string> {
    if (await this.admins.isPlatformAdmin()) return adminPath;
    return pathForStatus(await this.owners.myStatus());
  }
}
