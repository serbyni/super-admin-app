import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { msg } from "@/i18n/msg";
import { loginWithNext, tenantDashboard } from "@/lib/auth/routes";
import { isDataError } from "@/lib/data/errors";
import { serverApi } from "@/lib/data/server-api";
import { can, defineAbility, type AppAbility } from "./ability";
import type { Permission } from "./permissions";
import type { Access } from "./schema";

export type TenantAccess = Access & {
  user: NonNullable<Awaited<ReturnType<ReturnType<typeof serverApi>["auth"]["currentUser"]>>>;
  slug: string;
  ability: AppAbility;
};

/**
 * The signed-in member's access to café `slug` (once per request), or null when they are not a
 * member. Owners also need an ACTIVE owner account for their own café.
 */
export const getTenantAccess = cache(
  async (slug: string): Promise<TenantAccess | "signed-out" | null> => {
    const api = serverApi();
    const user = await api.auth.currentUser();
    if (!user) return "signed-out";
    let access: Access;
    try {
      access = await api.access.mine(slug);
    } catch (e) {
      if (isDataError(e)) return null;
      throw e;
    }
    if (access.isOwner) {
      const me = await api.owners.me();
      if (me?.status !== "active" || me.cafeSlug !== slug) return null;
    }
    return { ...access, user, slug, ability: defineAbility(access.permissions) };
  },
);

/**
 * Page guard: a member of café `slug` (signed out → login; not a member → their own home). With
 * `perm`, members without it (or off shift) see the "no access" page instead.
 */
export async function requireTenantAccess(slug: string, perm?: Permission | readonly Permission[]) {
  const a = await getTenantAccess(slug);
  if (a === "signed-out") redirect(loginWithNext(tenantDashboard(slug)));
  if (!a) redirect(await serverApi().auth.homePath());
  if (perm && !can(a.ability, perm)) {
    redirect(`${tenantDashboard(slug).replace(/\/$/, "")}/no-access`);
  }
  return a;
}

/** Server actions: the member may do `perm` (else a translated "no permission" message). */
export async function ensureCan(
  slug: string,
  perm: Permission | readonly Permission[],
): Promise<{ ok: true; access: TenantAccess } | { ok: false; message: string }> {
  const a = await getTenantAccess(slug);
  if (a === "signed-out" || !a) return { ok: false, message: msg("noPermission") };
  if (!can(a.ability, perm))
    return { ok: false, message: msg(a.onShift ? "noPermission" : "offShift") };
  return { ok: true, access: a };
}
