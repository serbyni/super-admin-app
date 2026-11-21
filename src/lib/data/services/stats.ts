import "server-only";
import {
  menuStatsSchema,
  tableStatsSchema,
  type MenuStats,
  type TableStats,
} from "@/lib/stats/page-schemas";
import { statsSchema, type Stats } from "@/lib/stats/schema";
import { unwrap } from "../errors";
import type { LazyDb } from "../types";

/** Statistics of the owner's café for a period (yyyy-mm-dd, café time). Errors: "forbidden" | "invalid_input". */
export class StatsService {
  constructor(private readonly db: LazyDb) {}

  async get(slug: string, from: string, to: string): Promise<Stats> {
    const raw = unwrap(
      "get_my_stats",
      await (await this.db()).rpc("get_my_stats", { p_slug: slug, p_from: from, p_to: to }),
    );
    return statsSchema.parse(raw);
  }

  /** Sales per menu item, category and option choice. */
  async menu(slug: string, from: string, to: string): Promise<MenuStats> {
    const raw = unwrap(
      "get_my_menu_stats",
      await (await this.db()).rpc("get_my_menu_stats", { p_slug: slug, p_from: from, p_to: to }),
    );
    return menuStatsSchema.parse(raw);
  }

  /** Scans and orders per table, plus the café menu QR code. */
  async tables(slug: string, from: string, to: string): Promise<TableStats> {
    const raw = unwrap(
      "get_my_table_stats",
      await (await this.db()).rpc("get_my_table_stats", { p_slug: slug, p_from: from, p_to: to }),
    );
    return tableStatsSchema.parse(raw);
  }
}
