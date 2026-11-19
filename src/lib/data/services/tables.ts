import "server-only";
import type { Json } from "@/lib/supabase/database.types";
import { floorSchema, type Floor, type TableShape } from "@/lib/tables/schema";
import { unwrap } from "../errors";
import type { LazyDb } from "../types";

export type AreaInput = { name: string; widthM: number; depthM: number };
export type TableInput = {
  areaId: string;
  label: string;
  seats: number;
  shape: TableShape;
  isActive: boolean;
};
export type LayoutItem = { id: string; x: number; y: number; rotation: number };

/**
 * Tables & QR codes of the owner's café (every SQL function checks ownership).
 * Errors: DataError "forbidden" | "invalid_input" (field via inputField()) | "conflict"
 * (label/name taken) | "in_use" (area still has tables) | "stale_list".
 */
export class TablesService {
  constructor(private readonly db: LazyDb) {}

  async floor(slug: string): Promise<Floor> {
    const raw = unwrap(
      "get_my_floor",
      await (await this.db()).rpc("get_my_floor", { p_slug: slug }),
    );
    return floorSchema.parse(raw);
  }

  async saveArea(slug: string, id: string | null, a: AreaInput): Promise<string> {
    return unwrap(
      "save_my_area",
      await (
        await this.db()
      ).rpc("save_my_area", {
        p_slug: slug,
        p_id: id,
        p_name: a.name,
        p_width_m: a.widthM,
        p_depth_m: a.depthM,
      }),
    );
  }

  async deleteArea(slug: string, id: string): Promise<void> {
    unwrap(
      "delete_my_area",
      await (await this.db()).rpc("delete_my_area", { p_slug: slug, p_id: id }),
    );
  }

  async reorderAreas(slug: string, ids: string[]): Promise<void> {
    unwrap(
      "reorder_my_areas",
      await (await this.db()).rpc("reorder_my_areas", { p_slug: slug, p_ids: ids }),
    );
  }

  async saveTable(slug: string, id: string | null, t: TableInput): Promise<string> {
    return unwrap(
      "save_my_table",
      await (
        await this.db()
      ).rpc("save_my_table", {
        p_slug: slug,
        p_id: id,
        p_area_id: t.areaId,
        p_label: t.label,
        p_seats: t.seats,
        p_shape: t.shape,
        p_is_active: t.isActive,
      }),
    );
  }

  async saveLayout(slug: string, layout: LayoutItem[]): Promise<void> {
    unwrap(
      "save_my_layout",
      await (
        await this.db()
      ).rpc("save_my_layout", {
        p_slug: slug,
        p_layout: layout as unknown as Json,
      }),
    );
  }

  async deleteTable(slug: string, id: string): Promise<void> {
    unwrap(
      "delete_my_table",
      await (await this.db()).rpc("delete_my_table", { p_slug: slug, p_id: id }),
    );
  }

  /** New QR code for a table, or for the café menu (tableId null). The old code is retired. */
  async regenerateCode(slug: string, tableId: string | null): Promise<string> {
    return unwrap(
      "regenerate_my_qr_code",
      await (await this.db()).rpc("regenerate_my_qr_code", { p_slug: slug, p_table_id: tableId }),
    );
  }
}
