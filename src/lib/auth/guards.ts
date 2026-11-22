import "server-only";
import { redirect } from "next/navigation";
import { serverApi } from "@/lib/data/server-api";
import type { OwnerStatus } from "./owner-status";
import { loginWithNext, ROUTES, tenantSettings } from "./routes";

/*
 * Route guards for layouts and pages. The proxy does a fast cookie-only redirect first; these run
 * on the server with the real session + database state. Data access is protected independently
 * (every admin RPC re-checks is_platform_admin in SQL).
 *
 * Rule: signed out → /login?next=…; signed in but wrong role/state → that user's own home page.
 */

/** Super admins only. */
export async function requireAdmin(next: string = ROUTES.adminHome) {
  const api = serverApi();
  const user = await api.auth.currentUser();
  if (!user) redirect(loginWithNext(next));
  if (!(await api.admins.isPlatformAdmin())) redirect(await api.auth.homePath());
  return { user };
}

/**
 * Accounts with a dashboard — super admins and ACTIVE café owners — for actions on their own
 * account (profile, email, password). Returns where their Settings page is.
 */
export async function requireAccountUser() {
  const api = serverApi();
  const user = await api.auth.currentUser();
  if (!user) redirect(ROUTES.login);
  if (await api.admins.isPlatformAdmin()) {
    return { user, kind: "admin" as const, settingsPath: ROUTES.adminSettings };
  }
  const me = await api.owners.me();
  if (me?.status === "active" && me.cafeSlug) {
    return { user, kind: "owner" as const, settingsPath: tenantSettings(me.cafeSlug) };
  }
  redirect(await api.auth.homePath());
}

/**
 * Status pages (complete profile, pending, onboarding…): signed-in owners whose status is in
 * `allowed` (null = signed in without an owner account). Others go to their own page.
 */
export async function requireOwnerStage(allowed: readonly (OwnerStatus | null)[]) {
  const api = serverApi();
  const user = await api.auth.currentUser();
  if (!user) redirect(ROUTES.login);
  if (await api.admins.isPlatformAdmin()) redirect(ROUTES.adminHome);
  const me = await api.owners.me();
  const status = me?.status ?? null;
  if (!allowed.includes(status)) redirect(await api.auth.homePath());
  return { user, status, cafeSlug: me?.cafeSlug ?? null };
}

/** Guest-only pages (login, register, forgot password): signed-in users go home. */
export async function redirectIfSignedIn() {
  const api = serverApi();
  if (await api.auth.currentUser()) redirect(await api.auth.homePath());
}
