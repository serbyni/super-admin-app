import { z } from "zod";

/* Dashboard statistics as returned by get_my_stats (see migration 20261121111742_stats). */

const num = z.coerce.number();
const minutes = z.coerce.number().nullable();

const totalsSchema = z.object({
  orders: num,
  revenue: num,
  paidRevenue: num,
  unpaid: num,
  declined: num,
  cancelled: num,
});
export type StatsTotals = z.infer<typeof totalsSchema>;

const rankedItem = z.object({ name: z.string(), quantity: num, revenue: num });
export type RankedItem = z.infer<typeof rankedItem>;

export const statsSchema = z.object({
  from: z.string(),
  to: z.string(),
  previousFrom: z.string(),
  previousTo: z.string(),
  hourly: z.boolean(),
  today: z.string(),
  totals: totalsSchema,
  previous: totalsSchema,
  /** One bucket per day (at = yyyy-mm-dd) or per hour (at = "00".."23"), empty buckets included. */
  series: z.array(z.object({ at: z.string(), orders: num, revenue: num })),
  topByQuantity: z.array(rankedItem),
  topByRevenue: z.array(rankedItem),
  topOptions: z.array(
    z.object({
      item: z.string(),
      group: z.string().nullable(),
      choice: z.string().nullable(),
      quantity: num,
      share: num.nullable(),
    }),
  ),
  /** day 0 = Monday … 6 = Sunday, café time; only cells with orders. */
  heatmap: z.array(z.object({ day: num, hour: num, orders: num })),
  channels: z.object({
    table: z.object({ orders: num, revenue: num }),
    takeaway: z.object({ orders: num, revenue: num }),
  }),
  topTables: z.array(z.object({ label: z.string().nullable(), orders: num, revenue: num })),
  qrScans: num,
  timing: z.object({ toAccept: minutes, toReady: minutes, toServe: minutes }),
});
export type Stats = z.infer<typeof statsSchema>;

/** Average ticket (0 when no order). */
export const averageTicket = (t: StatsTotals) => (t.orders ? t.revenue / t.orders : 0);
