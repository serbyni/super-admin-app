import "server-only";
import {
  accessSchema,
  roleSchema,
  shiftSchema,
  type Access,
  type Role,
  type Shift,
} from "@/lib/access/schema";
import { z } from "zod";
import { unwrap } from "../errors";
import type { LazyDb } from "../types";

/**
 * Access control of a café: the signed-in member's access (role, shift, permissions) and, for the
 * owner, the café's roles and shifts. Errors: DataError "forbidden" | "invalid_input" |
 * "name_taken" | "in_use" | "invalid_state" (Owner role locked) | "stale_list".
 */
export class AccessService {
  constructor(private readonly db: LazyDb) {}

  async mine(slug: string): Promise<Access> {
    const raw = unwrap("get_my_access", await (await this.db()).rpc("get_my_access", { p_slug: slug }));
    return accessSchema.parse(raw);
  }

  async roles(slug: string): Promise<Role[]> {
    const raw = unwrap("get_my_roles", await (await this.db()).rpc("get_my_roles", { p_slug: slug }));
    return z.array(roleSchema).parse(raw);
  }

  async saveRole(
    slug: string,
    id: string | null,
    r: { name: string; description: string; permissions: string[] },
  ): Promise<string> {
    return unwrap(
      "save_my_role",
      await (
        await this.db()
      ).rpc("save_my_role", {
        p_slug: slug,
        p_id: id,
        p_name: r.name,
        p_description: r.description,
        p_permissions: r.permissions,
      }),
    );
  }

  async deleteRole(slug: string, id: string): Promise<void> {
    unwrap("delete_my_role", await (await this.db()).rpc("delete_my_role", { p_slug: slug, p_id: id }));
  }

  async reorderRoles(slug: string, ids: string[]): Promise<void> {
    unwrap("reorder_my_roles", await (await this.db()).rpc("reorder_my_roles", { p_slug: slug, p_ids: ids }));
  }

  async shifts(slug: string): Promise<Shift[]> {
    const raw = unwrap("get_my_shifts", await (await this.db()).rpc("get_my_shifts", { p_slug: slug }));
    return z.array(shiftSchema).parse(raw);
  }

  async saveShift(
    slug: string,
    id: string | null,
    s: { name: string; days: number[]; starts: string; ends: string },
  ): Promise<string> {
    return unwrap(
      "save_my_shift",
      await (
        await this.db()
      ).rpc("save_my_shift", {
        p_slug: slug,
        p_id: id,
        p_name: s.name,
        p_days: s.days,
        p_starts: s.starts,
        p_ends: s.ends,
      }),
    );
  }

  async deleteShift(slug: string, id: string): Promise<void> {
    unwrap("delete_my_shift", await (await this.db()).rpc("delete_my_shift", { p_slug: slug, p_id: id }));
  }

  async reorderShifts(slug: string, ids: string[]): Promise<void> {
    unwrap(
      "reorder_my_shifts",
      await (await this.db()).rpc("reorder_my_shifts", { p_slug: slug, p_ids: ids }),
    );
  }
}
