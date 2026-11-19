import { NextResponse, type NextRequest } from "next/server";
import {
  isAdminPath,
  isGuestOnlyPath,
  loginWithNext,
  ROUTES,
  safeNext,
  tenantSlugOf,
} from "@/lib/auth/routes";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Runs before every page: refreshes the session, then does the FAST, cookie-only redirects:
 *   signed out on (admin) or (tenant) pages → /login?next=<page>
 *   signed in on guest-only pages            → /auth/home (resolves admin / café / status page)
 * Role and status checks need the database, so they live in the layout guards (src/lib/auth/guards).
 */
export async function proxy(request: NextRequest) {
  const { response, signedIn } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  const redirectTo = (to: string) => {
    const res = NextResponse.redirect(new URL(to, request.url));
    // Keep refreshed auth cookies on the redirect.
    for (const cookie of response.cookies.getAll()) res.cookies.set(cookie);
    return res;
  };

  if (!signedIn && (isAdminPath(pathname) || tenantSlugOf(pathname))) {
    return redirectTo(loginWithNext(pathname + search));
  }
  if (signedIn && isGuestOnlyPath(pathname)) {
    const next = safeNext(request.nextUrl.searchParams.get("next"));
    return redirectTo(next ? `${ROUTES.home}?next=${encodeURIComponent(next)}` : ROUTES.home);
  }
  return response;
}

export const config = {
  // Skip static assets and image optimisation.
  matcher: [
    // QR scans (/q/<code>) need no session: skip the auth refresh so they redirect fast.
    "/((?!_next/static|_next/image|favicon.ico|q/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
