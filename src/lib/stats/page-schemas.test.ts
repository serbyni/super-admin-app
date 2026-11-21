import { describe, expect, it } from "vitest";
import {
  menuSales,
  menuStatsSchema,
  noSaleItems,
  optionKey,
  tableStatsSchema,
} from "./page-schemas";

const range = {
  from: "2025-03-03",
  to: "2025-03-09",
  previousFrom: "2025-02-24",
  previousTo: "2025-03-02",
};

const menu = menuStatsSchema.parse({
  ...range,
  items: [{ itemId: "a", sold: 3, revenue: "15.000", prevSold: 1, prevRevenue: 5 }],
  categories: [{ categoryId: "c1", sold: 3, revenue: 15 }],
  options: [{ itemId: "a", group: "Size", choice: "Grand", count: 1, share: "0.500" }],
  totals: { sold: 3, items: 1, revenue: 15 },
  previous: { sold: 1, items: 1, revenue: 5 },
});

describe("page stats schemas", () => {
  it("parse the SQL replies", () => {
    expect(menu.items[0].revenue).toBe(15);
    expect(menu.options[0].share).toBe(0.5);
    const t = tableStatsSchema.parse({
      ...range,
      tables: [
        {
          tableId: "t",
          scans: 10,
          prevScans: 5,
          orders: 1,
          prevOrders: 0,
          revenue: 10,
          series: [4, 0, 6],
        },
        {
          tableId: "u",
          scans: 0,
          prevScans: 0,
          orders: 0,
          prevOrders: 0,
          revenue: 0,
          series: null,
        },
      ],
      menu: { scans: 0, prevScans: 0, takeawayOrders: 1, takeawayRevenue: 5 },
      totals: { scans: 10, orders: 2, revenue: 10, tableOrders: 1 },
      previous: { scans: 5, orders: 1, revenue: 0, tableOrders: 0 },
    });
    expect(t.tables[0].series).toEqual([4, 0, 6]);
    expect(t.tables[1].series).toEqual([]);
  });

  it("no sale = orderable items that sold nothing", () => {
    const base = { isVisible: true, isAvailable: true, price: 5, categoryId: "c1" };
    const items = [
      { id: "a", ...base }, // sold
      { id: "b", ...base }, // no sale
      { id: "c", ...base, isVisible: false },
      { id: "d", ...base, isAvailable: false },
      { id: "e", ...base, price: null },
      { id: "f", ...base, categoryId: "hidden" },
    ];
    expect(noSaleItems(items, new Set(["c1"]), menu).map((i) => i.id)).toEqual(["b"]);
  });
});

describe("menuSales", () => {
  it("builds the editor figures", () => {
    const s = menuSales(menu);
    expect(s.items.a).toEqual({ sold: 3, revenue: 15, change: 200 });
    expect(s.categoryShare.c1).toBe(1);
    expect(s.options.a[optionKey("Size", "Grand")]).toBe(0.5);
  });
});
