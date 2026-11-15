import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { pathForStatus, isOwnerStatus } from "@/lib/auth/owner-status";
import { createClient } from "@/lib/supabase/server";

/**
 * Single landing point for:
 *  - email confirmation links (`token_hash` + `type`, works on any device), and
 *  - OAuth / PKCE redirects (`code`, Google & Facebook).
 * Then routes the owner by status.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const supabase = await createClient();

  const { error } =
    tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : code
        ? await supabase.auth.exchangeCodeForSession(code)
        : { error: new Error("missing_code") };

  if (error) {
    return NextResponse.redirect(new URL("/login?error=link_invalid", origin));
  }

  const { data: status } = await supabase.rpc("get_my_owner_status");
  return NextResponse.redirect(
    new URL(pathForStatus(isOwnerStatus(status) ? status : null), origin),
  );
}
