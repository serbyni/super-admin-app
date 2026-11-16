import "server-only";
import { cacheLife, cacheTag, updateTag } from "next/cache";
import type { AdminBusinessType, BusinessType, LocalizedText } from "@/lib/business-types/schema";
import { createPublicClient } from "@/lib/supabase/public";
import { unwrap } from "../errors";
import type { LazyDb } from "../types";

/** Cache tag of the public list; every admin write refreshes it. */
export const BUSINESS_TYPES_TAG = "business-types";

export type SaveBusinessTypeInput = {
  /** null → create */
  id: string | null;
  slug: string;
  name: LocalizedText;
  icon: string;
  isActive: boolean;
};

/**
 * Cached public list. "use cache" needs a top-level function and a session-less client,
 * so the service method delegates here.
 */
async function cachedActiveBusinessTypes(): Promise<BusinessType[]> {
  "use cache";
  cacheTag(BUSINESS_TYPES_TAG);
  cacheLife("hours");
  const rows = unwrap("list_business_types", await createPublicClient().rpc("list_business_types"));
  return rows.map((r) => ({ slug: r.slug, icon: r.icon, name: r.name as LocalizedText }));
}

export class BusinessTypesService {
  constructor(private readonly db: LazyDb) {}

  /* ── Public ─────────────────────────────────────────────────────────────── */

  /** Active business types for the register form, in admin order (cached). */
  listActive(): Promise<BusinessType[]> {
    return cachedActiveBusinessTypes();
  }

  async isActive(slug: string): Promise<boolean> {
    return (await this.listActive()).some((t) => t.slug === slug);
  }

  /* ── Super admin (the SQL functions check is_platform_admin) ───────────── */

  async adminList(): Promise<AdminBusinessType[]> {
    const rows = unwrap(
      "admin_list_business_types",
      await (await this.db()).rpc("admin_list_business_types"),
    );
    return rows.map((r) => ({ ...r, name: r.name as LocalizedText }));
  }

  /** Create or update; returns the id. Throws DataError "conflict" when the slug is taken. */
  async adminSave(input: SaveBusinessTypeInput): Promise<string> {
    const id = unwrap(
      "admin_save_business_type",
      await (
        await this.db()
      ).rpc("admin_save_business_type", {
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
  async adminDelete(id: string): Promise<void> {
    unwrap(
      "admin_delete_business_type",
      await (await this.db()).rpc("admin_delete_business_type", { p_id: id }),
    );
    updateTag(BUSINESS_TYPES_TAG);
  }

  /** Full order, top to bottom. Throws DataError "stale_list" when the list changed meanwhile. */
  async adminReorder(ids: string[]): Promise<void> {
    unwrap(
      "admin_reorder_business_types",
      await (await this.db()).rpc("admin_reorder_business_types", { p_ids: ids }),
    );
    updateTag(BUSINESS_TYPES_TAG);
  }
}
