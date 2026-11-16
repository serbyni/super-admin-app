import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { completeAuthRedirect, homePathForCurrentUser } from "@/lib/data/auth";

/**
 * Single landing point for:
 *  - email confirmation links (`token_hash` + `type`, works on any device), and
 *  - OAuth / PKCE redirects (`code`, Google & Facebook).
 * Then sends the user home (admins → /admin, owners by status).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const ok = await completeAuthRedirect({
    tokenHash: searchParams.get("token_hash"),
    type: searchParams.get("type") as EmailOtpType | null,
    code: searchParams.get("code"),
  });
  if (!ok) return NextResponse.redirect(new URL("/login?error=link_invalid", origin));
  return NextResponse.redirect(new URL(await homePathForCurrentUser(), origin));
}
