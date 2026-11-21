import { describe, expect, it } from "vitest";
import { averageTicket, statsSchema } from "./schema";

// Shape of a real get_my_stats reply (numerics come back as numbers or strings).
const reply = {
  from: "2025-03-03",
  to: "2025-03-09",
  previousFrom: "2025-02-24",
  previousTo: "2025-03-02",
  hourly: false,
  today: "2026-11-21",
  totals: { orders: 3, unpaid: 2, revenue: "20.500", declined: 1, cancelled: 0, paidRevenue: 12.5 },
  previous: { orders: 1, unpaid: 0, revenue: 10, declined: 0, cancelled: 0, paidRevenue: 10 },
  series: [{ at: "2025-03-03", orders: 2, revenue: 17.5 }],
  topByQuantity: [{ name: "Latte", revenue: 18, quantity: 4 }],
  topByRevenue: [{ name: "Latte", revenue: 18, quantity: 4 }],
  topOptions: [{ item: "Latte", group: "Size", share: 0.5, choice: "Grand", quantity: 2 }],
  heatmap: [{ day: 0, hour: 9, orders: 1 }],
  channels: { table: { orders: 2, revenue: 15.5 }, takeaway: { orders: 1, revenue: 5 } },
  topTables: [{ label: "T1", orders: 1, revenue: 12.5 }],
  qrScans: 0,
  timing: { toReady: 10, toServe: 3, toAccept: null },
};

describe("statsSchema", () => {
  it("parses a get_my_stats reply", () => {
    const s = statsSchema.parse(reply);
    expect(s.totals.revenue).toBe(20.5);
    expect(s.timing.toAccept).toBeNull();
    expect(averageTicket(s.totals)).toBeCloseTo(6.833, 3);
    expect(averageTicket({ ...s.totals, orders: 0 })).toBe(0);
  });
});
