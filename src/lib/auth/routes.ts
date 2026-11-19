/**
 * Route map used by the proxy, the layout guards and the "where does this user belong" rule.
 * Pure (no server imports) so the proxy can use it.
 */

export const ROUTES = {
  login: "/login",
  adminHome: "/admin",
  adminSettings: "/admin/settings",
  onboarding: "/onboarding",
  /** Resolves the signed-in user's home and redirects there. */
  home: "/auth/home",
} as const;

/** Pages only for signed-out visitors: a signed-in user is sent to their home. */
export const GUEST_ONLY_PATHS = ["/login", "/register", "/forgot-password"] as const;

export function isGuestOnlyPath(pathname: string): boolean {
  return (GUEST_ONLY_PATHS as readonly string[]).includes(pathname.replace(/\/$/, "") || "/");
}

export function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

/** Owner dashboard of one café: /<slug>/dashboard[/…]. */
export function tenantDashboard(slug: string): string {
  return `/${slug}/dashboard`;
}

/** Café owner's settings page (Café + Profile tabs). */
export function tenantSettings(slug: string): string {
  return `${tenantDashboard(slug)}/settings`;
}

// Café address format: same as SLUG_PATTERN in src/lib/cafes/slug.ts (kept inline: this file
// must stay import-free for the proxy).
const TENANT_PATH = /^\/([a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9]))\/dashboard(\/|$)/;

/** The café slug when the path is a tenant (owner dashboard) page, else null. */
export function tenantSlugOf(pathname: string): string | null {
  return TENANT_PATH.exec(pathname)?.[1] ?? null;
}

/** Same-site relative path only (no //host, no protocol): safe as a post-login destination. */
export function safeNext(next: string | null | undefined): string | null {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")
    ? next
    : null;
}

/** /login?next=<path> */
export function loginWithNext(pathname: string): string {
  return `${ROUTES.login}?next=${encodeURIComponent(pathname)}`;
}
