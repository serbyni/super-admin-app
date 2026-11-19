import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { kickEmailDispatch } from "@/lib/data/kick-email";
import { serverApi } from "@/lib/data/server-api";
import { deleteAuthUser } from "@/lib/data/service-admin";

/**
 * Single landing point for:
 *  - email confirmation links (`token_hash` + `type`, works on any device), and
 *  - OAuth / PKCE redirects (`code`, Google & Facebook).
 * Then sends the user home (admins → /admin, owners by status).
 * Google/Facebook is for SIGNING IN only: a provider account without a Serbi registration is
 * removed again and sent to /login with a "Register" toast.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const api = serverApi();
  const ok = await api.auth.completeRedirect({
    tokenHash: searchParams.get("token_hash"),
    type: searchParams.get("type") as EmailOtpType | null,
    code: searchParams.get("code"),
  });
  if (!ok) return NextResponse.redirect(new URL("/login?error=link_invalid", origin));

  const user = await api.auth.currentUser();
  if (user && (await api.auth.isUnregisteredOAuthUser(user))) {
    const provider = String(user.app_metadata?.provider ?? "");
    await api.auth.signOut();
    await deleteAuthUser(user.id);
    const q = new URLSearchParams({ error: "no_account" });
    if (/^[a-z]+$/.test(provider)) q.set("provider", provider);
    return NextResponse.redirect(new URL(`/login?${q}`, origin));
  }

  // Confirming the email may have created register_new_user: send its email after responding.
  kickEmailDispatch();
  return NextResponse.redirect(new URL(await api.auth.homePath(searchParams.get("next")), origin));
}
