import { NextResponse, type NextRequest } from "next/server";
import { serverApi } from "@/lib/data/server-api";

/**
 * Landing point of the "Change email address" link (token_hash + type=email_change).
 * With Supabase "Secure email change", the current AND the new address each get a link: after
 * the first one the change is still pending (`new_email` set), after both it is done.
 * Café owners go back to Settings → Profile with the result; others go home.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const api = serverApi();
  const ok = await api.auth.completeEmailChange(searchParams.get("token_hash"));
  if (!ok) return NextResponse.redirect(new URL("/login?error=link_invalid", origin));

  const user = await api.auth.currentUser();
  const result = user?.new_email ? "pending" : "confirmed";
  const me = await api.owners.me();
  const target =
    me?.status === "active" && me.cafeSlug
      ? `/${me.cafeSlug}/dashboard/settings?tab=profile&email=${result}`
      : await api.auth.homePath();
  return NextResponse.redirect(new URL(target, origin));
}
