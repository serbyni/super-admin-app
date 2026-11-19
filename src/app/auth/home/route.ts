import { NextResponse, type NextRequest } from "next/server";
import { ROUTES } from "@/lib/auth/routes";
import { serverApi } from "@/lib/data/server-api";

/**
 * GET /auth/home[?next=…] — sends the signed-in user to where they belong (admin, café dashboard
 * or their status page). Used by the proxy for signed-in visitors of guest-only pages.
 */
export async function GET(request: NextRequest) {
  const api = serverApi();
  const to = (await api.auth.currentUser())
    ? await api.auth.homePath(request.nextUrl.searchParams.get("next"))
    : ROUTES.login;
  return NextResponse.redirect(new URL(to, request.url));
}
