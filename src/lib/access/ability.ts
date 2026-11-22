import { createMongoAbility, type MongoAbility } from "@casl/ability";
import { PERMISSIONS, sectionOf, actionOf, type Permission } from "./permissions";

/*
 * CASL ability of the signed-in member, from their permissions (get_my_access). Subjects are the
 * sections, actions the permission actions: ability.can("edit", "menu") ⇔ "menu.edit".
 */

export type AppAbility = MongoAbility<[string, string]>;

export function defineAbility(permissions: readonly string[]): AppAbility {
  const known = permissions.filter((p): p is Permission =>
    (PERMISSIONS as readonly string[]).includes(p),
  );
  return createMongoAbility<[string, string]>(
    known.map((p) => ({ action: actionOf(p), subject: sectionOf(p) })),
  );
}

/** "menu.edit" or ["menu.availability", "menu.edit"] (any of) → can? */
export function can(ability: AppAbility, perm: Permission | readonly Permission[]): boolean {
  const list = typeof perm === "string" ? [perm] : perm;
  return list.some((p) => ability.can(actionOf(p), sectionOf(p)));
}
