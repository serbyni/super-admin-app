import { NextResponse, type NextRequest } from "next/server";
import { ROUTES, tenantSettings } from "@/lib/auth/routes";
import { serverApi, type ServerApi } from "@/lib/data/server-api";

/**
 * Landing point of the "Change email address" link (token_hash + type=email_change).
 * With Supabase "Secure email change", the current AND the new address each get a link: after
 * the first one the change is still pending (`new_email` set), after both it is done.
 * Super admins and café owners go back to their Settings → Profile with the result.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const api = serverApi();
  const ok = await api.auth.completeEmailChange(searchParams.get("token_hash"));
  if (!ok) return NextResponse.redirect(new URL("/login?error=link_invalid", origin));

  const user = await api.auth.currentUser();
  const result = user?.new_email ? "pending" : "confirmed";
  const target = (await api.admins.isPlatformAdmin())
    ? `${ROUTES.adminSettings}?email=${result}`
    : await ownerSettingsOrHome(api, result);
  return NextResponse.redirect(new URL(target, origin));
}

async function ownerSettingsOrHome(api: ServerApi, result: string): Promise<string> {
  const me = await api.owners.me();
  return me?.status === "active" && me.cafeSlug
    ? `${tenantSettings(me.cafeSlug)}?tab=profile&email=${result}`
    : api.auth.homePath();
}
