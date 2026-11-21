import { z } from "zod";

/* Page statistics (migration 20261121113841_page_stats): menu items and tables for a period. */

const num = z.coerce.number();
const range = {
  from: z.string(),
  to: z.string(),
  previousFrom: z.string(),
  previousTo: z.string(),
};

const menuTotals = z.object({ sold: num, revenue: num, items: num });

export const menuStatsSchema = z.object({
  ...range,
  items: z.array(
    z.object({ itemId: z.string(), sold: num, revenue: num, prevSold: num, prevRevenue: num }),
  ),
  categories: z.array(z.object({ categoryId: z.string(), sold: num, revenue: num })),
  /** share = part of the item's order lines with this choice (0–1). */
  options: z.array(
    z.object({
      itemId: z.string(),
      group: z.string().nullable(),
      choice: z.string().nullable(),
      count: num,
      share: num,
    }),
  ),
  totals: menuTotals,
  previous: menuTotals,
});
export type MenuStats = z.infer<typeof menuStatsSchema>;
export type ItemStats = MenuStats["items"][number];

const tableTotals = z.object({ scans: num, tableOrders: num, orders: num, revenue: num });

export const tableStatsSchema = z.object({
  ...range,
  tables: z.array(
    z.object({
      tableId: z.string(),
      scans: num,
      prevScans: num,
      orders: num,
      prevOrders: num,
      revenue: num,
      /** Scans per day of the period, oldest first. */
      series: z
        .array(num)
        .nullable()
        .transform((s) => s ?? []),
    }),
  ),
  menu: z.object({ scans: num, prevScans: num, takeawayOrders: num, takeawayRevenue: num }),
  totals: tableTotals,
  previous: tableTotals,
});
export type TableStats = z.infer<typeof tableStatsSchema>;
export type TableStat = TableStats["tables"][number];

/** Item stats by id (items without sales → undefined). */
export const byItem = (s: MenuStats) => new Map(s.items.map((i) => [i.itemId, i]));

/**
 * Items customers can order that sold nothing in the period: visible, priced, available, in a
 * visible category.
 */
export function noSaleItems<
  I extends {
    id: string;
    isVisible: boolean;
    isAvailable: boolean;
    price: number | null;
    categoryId: string;
  },
>(items: I[], visibleCategories: Set<string>, stats: MenuStats): I[] {
  const sold = byItem(stats);
  return items.filter(
    (i) =>
      i.isVisible &&
      i.isAvailable &&
      i.price !== null &&
      visibleCategories.has(i.categoryId) &&
      !(sold.get(i.id)?.sold ?? 0),
  );
}
