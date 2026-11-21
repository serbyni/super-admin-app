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

/** Sales figures the menu editor shows (plain data for the client component). */
export type MenuSales = {
  /** By item id; items without an entry sold nothing. change = % vs the previous period. */
  items: Record<string, { sold: number; revenue: number; change: number | null }>;
  /** Category id → share of the period's revenue (0–1). */
  categoryShare: Record<string, number>;
  /** Item id → `${group}\u0000${choice}` → share of the item's order lines (0–1). */
  options: Record<string, Record<string, number>>;
};

export const optionKey = (group: string | null, choice: string | null) =>
  `${group ?? ""}\u0000${choice ?? ""}`;

export function menuSales(s: MenuStats): MenuSales {
  const total = s.totals.revenue;
  const options: MenuSales["options"] = {};
  for (const o of s.options) (options[o.itemId] ??= {})[optionKey(o.group, o.choice)] = o.share;
  return {
    items: Object.fromEntries(
      s.items
        .filter((i) => i.sold > 0)
        .map((i) => [
          i.itemId,
          {
            sold: i.sold,
            revenue: i.revenue,
            change: i.prevRevenue ? ((i.revenue - i.prevRevenue) / i.prevRevenue) * 100 : null,
          },
        ]),
    ),
    categoryShare: Object.fromEntries(
      s.categories.map((c) => [c.categoryId, total ? c.revenue / total : 0]),
    ),
    options,
  };
}

/** Table figures the tables editor shows (plain data for the client component). */
export type TablesSales = {
  tables: Record<string, { scans: number; orders: number; revenue: number; series: number[] }>;
  menu: TableStats["menu"];
};

export const tablesSales = (s: TableStats): TablesSales => ({
  tables: Object.fromEntries(
    s.tables.map((t) => [
      t.tableId,
      { scans: t.scans, orders: t.orders, revenue: t.revenue, series: t.series },
    ]),
  ),
  menu: s.menu,
});
