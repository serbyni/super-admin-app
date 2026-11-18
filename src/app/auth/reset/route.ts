import { NextResponse, type NextRequest } from "next/server";
import { serverApi } from "@/lib/data/server-api";

/**
 * GET /auth/reset — landing point of the "Reset password" email.
 * Accepts our template link (?token_hash=…&type=recovery) and Supabase's default link (?code=…),
 * opens a recovery session, then shows /reset-password. Invalid/expired → /forgot-password.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const ok = await serverApi().auth.completeRecovery({
    tokenHash: searchParams.get("token_hash"),
    code: searchParams.get("code"),
  });
  return NextResponse.redirect(
    new URL(ok ? "/reset-password" : "/forgot-password?error=link_expired", origin),
  );
}
