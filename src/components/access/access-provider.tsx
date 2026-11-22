"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { can as canDo, defineAbility, type AppAbility } from "@/lib/access/ability";
import type { Permission } from "@/lib/access/permissions";

/*
 * The signed-in member's CASL ability in the café dashboard (from get_my_access, on the server).
 * It only shows/hides UI — the database checks every action again.
 */

const AccessContext = createContext<AppAbility>(defineAbility([]));

export function AccessProvider({
  permissions,
  children,
}: {
  permissions: readonly string[];
  children: ReactNode;
}) {
  const key = permissions.join(",");
  // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuilt only when the list changes
  const ability = useMemo(() => defineAbility(permissions), [key]);
  return <AccessContext.Provider value={ability}>{children}</AccessContext.Provider>;
}

export function useAbility(): AppAbility {
  return useContext(AccessContext);
}

/** can("menu.edit") or can(["menu.availability", "menu.edit"]) (any of). */
export function useCan(): (perm: Permission | readonly Permission[]) => boolean {
  const ability = useAbility();
  return (perm) => canDo(ability, perm);
}

/** Renders `children` only when the member may do `perm` (else `fallback`). */
export function Can({
  perm,
  children,
  fallback = null,
}: {
  perm: Permission | readonly Permission[];
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return useCan()(perm) ? children : fallback;
}
