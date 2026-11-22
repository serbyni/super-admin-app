/*
 * Café permissions (section.action). Same list as platform.permission_keys() in SQL — a test
 * checks they match. "edit"-like actions imply the section's "read". "staff.manage" belongs to
 * the locked Owner role only (never in a role editor).
 */

export const PERMISSIONS = [
  "dashboard.read",
  "orders.read",
  "orders.handle",
  "orders.settings",
  "menu.read",
  "menu.availability",
  "menu.edit",
  "tables.read",
  "tables.edit",
  "tables.qr",
  "website.read",
  "website.edit",
  "website.publish",
  "settings.cafe",
  "settings.hours",
  "settings.display",
  "settings.languages",
  "staff.manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export type Section = "dashboard" | "orders" | "menu" | "tables" | "website" | "settings" | "staff";
export const sectionOf = (p: Permission) => p.split(".")[0] as Section;
export const actionOf = (p: Permission) => p.split(".")[1];

/** Sections of the role editor, in order, with their permissions (staff.manage excluded). */
export const PERMISSION_GROUPS: {
  section: Exclude<Section, "staff">;
  permissions: Permission[];
}[] = (["orders", "menu", "tables", "website", "settings", "dashboard"] as const).map(
  (section) => ({
    section,
    permissions: PERMISSIONS.filter((p) => sectionOf(p) === section),
  }),
);

const READS = new Set<string>(PERMISSIONS.filter((p) => p.endsWith(".read")));

/** Other permissions an action needs beyond its section's read (publishing saves the draft). */
const NEEDS: Partial<Record<Permission, Permission[]>> = { "website.publish": ["website.edit"] };

/** Everything `p` needs: its section's ".read" (if any) and NEEDS, transitively. */
export function implied(p: Permission): Permission[] {
  const out = new Set<Permission>();
  const visit = (x: Permission) => {
    const r = `${sectionOf(x)}.read`;
    const direct = [...(r !== x && READS.has(r) ? [r as Permission] : []), ...(NEEDS[x] ?? [])];
    for (const y of direct) {
      if (out.has(y)) continue;
      out.add(y);
      visit(y);
    }
  };
  visit(p);
  return [...out];
}

/** Adds what each permission needs; drops unknown keys; never grants staff.manage. */
export function withImplied(list: readonly string[]): Permission[] {
  const set = new Set<Permission>();
  for (const k of list) {
    if (!(PERMISSIONS as readonly string[]).includes(k) || k === "staff.manage") continue;
    set.add(k as Permission);
    for (const r of implied(k as Permission)) set.add(r);
  }
  return PERMISSIONS.filter((p) => set.has(p));
}

/** Is `p` needed by another permission of the list (so it can't be turned off alone)? */
export function requiredBy(list: readonly Permission[], p: Permission): boolean {
  return list.some((x) => x !== p && implied(x).includes(p));
}

/** A role editor toggle: on adds what it needs; off also removes what needs it. */
export function togglePermission(
  list: readonly Permission[],
  p: Permission,
  on: boolean,
): Permission[] {
  if (on) return withImplied([...list, p]);
  return list.filter((x) => x !== p && !implied(x).includes(p));
}

/** Sidebar sections a set of permissions shows (Profile is always there, in Settings). */
export function visibleSections(perms: readonly string[]): Section[] {
  const has = (p: Permission) => perms.includes(p);
  const out: Section[] = [];
  if (has("dashboard.read")) out.push("dashboard");
  if (has("website.read")) out.push("website");
  if (has("menu.read")) out.push("menu");
  if (has("tables.read")) out.push("tables");
  if (has("orders.read")) out.push("orders");
  if (has("staff.manage")) out.push("staff");
  out.push("settings");
  return out;
}

/** Link of a section under the café dashboard base ("/slug/dashboard"). */
export function sectionHref(dashboard: string, section: Section): string {
  const base = dashboard.replace(/\/$/, "");
  return section === "dashboard" ? dashboard : `${base}/${section}`;
}
