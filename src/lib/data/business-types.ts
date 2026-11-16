import "server-only";
import { cacheLife, cacheTag, updateTag } from "next/cache";
import type { AdminBusinessType, BusinessType, LocalizedText } from "@/lib/business-types/schema";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";
import { unwrap } from "./errors";

/** Cache tag of the public list; every admin write refreshes it. */
export const BUSINESS_TYPES_TAG = "business-types";

/* ── Public (cached, no session) ─────────────────────────────────────────── */

/** Active business types for the register form, in admin order. */
export async function listActiveBusinessTypes(): Promise<BusinessType[]> {
  "use cache";
  cacheTag(BUSINESS_TYPES_TAG);
  cacheLife("hours");
  const rows = unwrap("list_business_types", await createPublicClient().rpc("list_business_types"));
  return rows.map((r) => ({ slug: r.slug, icon: r.icon, name: r.name as LocalizedText }));
}

export async function isActiveBusinessType(slug: string): Promise<boolean> {
  return (await listActiveBusinessTypes()).some((t) => t.slug === slug);
}

/* ── Super admin (user session; the SQL functions check is_platform_admin) ─ */

export async function adminListBusinessTypes(): Promise<AdminBusinessType[]> {
  const db = await createClient();
  const rows = unwrap("admin_list_business_types", await db.rpc("admin_list_business_types"));
  return rows.map((r) => ({ ...r, name: r.name as LocalizedText }));
}

export type SaveBusinessTypeInput = {
  /** null → create */
  id: string | null;
  slug: string;
  name: LocalizedText;
  icon: string;
  isActive: boolean;
};

/** Create or update; returns the id. Throws DataError "conflict" when the slug is taken. */
export async function adminSaveBusinessType(input: SaveBusinessTypeInput): Promise<string> {
  const db = await createClient();
  const id = unwrap(
    "admin_save_business_type",
    await db.rpc("admin_save_business_type", {
      // The SQL function accepts null (= create); generated arg types cannot express that.
      p_id: input.id as string,
      p_slug: input.slug,
      p_name: input.name,
      p_icon: input.icon,
      p_is_active: input.isActive,
    }),
  );
  updateTag(BUSINESS_TYPES_TAG);
  return id;
}

/** Throws DataError "in_use" when owners use this type (deactivate it instead). */
export async function adminDeleteBusinessType(id: string): Promise<void> {
  const db = await createClient();
  unwrap("admin_delete_business_type", await db.rpc("admin_delete_business_type", { p_id: id }));
  updateTag(BUSINESS_TYPES_TAG);
}

/** Full order, top to bottom. Throws DataError "stale_list" when the list changed meanwhile. */
export async function adminReorderBusinessTypes(ids: string[]): Promise<void> {
  const db = await createClient();
  unwrap(
    "admin_reorder_business_types",
    await db.rpc("admin_reorder_business_types", { p_ids: ids }),
  );
  updateTag(BUSINESS_TYPES_TAG);
}
