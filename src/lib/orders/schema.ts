import { z } from "zod";

/* Orders as returned by get_my_orders / get_public_order (see migration 20261120161443_orders). */

export const ORDER_STATUSES = [
  "new",
  "accepted",
  "preparing",
  "ready",
  "served",
  "declined",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export const OPEN_STATUSES: readonly OrderStatus[] = ["new", "accepted", "preparing", "ready"];

const num = z.coerce.number();

export const orderSchema = z.object({
  id: z.string().nullable().optional(),
  number: num,
  kind: z.enum(["table", "takeaway"]),
  tableLabel: z.string().nullable(),
  /** Previous table after a move (customer or staff). */
  movedFromLabel: z.string().nullable().optional(),
  customerName: z.string(),
  note: z.string(),
  status: z.enum(ORDER_STATUSES),
  declineReason: z.string(),
  subtotal: num,
  currency: z.string(),
  isPaid: z.boolean(),
  locale: z.string(),
  createdAt: z.string(),
  acceptedAt: z.string().nullable(),
  readyAt: z.string().nullable(),
  servedAt: z.string().nullable(),
  closedAt: z.string().nullable(),
  items: z.array(
    z.object({
      itemId: z.string().nullable(),
      name: z.string(),
      unitPrice: num,
      options: z.array(z.object({ group: z.string(), choice: z.string(), price: num })).catch([]),
      quantity: num,
      note: z.string(),
      lineTotal: num,
    }),
  ),
});
export type Order = z.infer<typeof orderSchema>;

export const openingSchema = z.object({
  openNow: z.boolean(),
  closesAt: z.string().optional(),
  opensAt: z.string().optional(),
  /** 0 = Monday. */
  opensDay: z.number().optional(),
});
export type Opening = z.infer<typeof openingSchema>;

export const boardSchema = z.object({
  acceptingOrders: z.boolean(),
  /** Table orders must come from within this distance of the café (metres). */
  orderRadiusM: z.coerce.number().default(100),
  ordering: openingSchema,
  today: z.string(),
  orders: z.array(orderSchema),
});
export type Board = z.infer<typeof boardSchema>;

/** Next step of the board's main button (null = no forward step). */
export function nextStatus(s: OrderStatus): OrderStatus | null {
  return s === "new"
    ? "accepted"
    : s === "accepted"
      ? "preparing"
      : s === "preparing"
        ? "ready"
        : s === "ready"
          ? "served"
          : null;
}

/** Board column of an open order. */
export function columnOf(s: OrderStatus): "new" | "progress" | "ready" | null {
  return s === "new"
    ? "new"
    : s === "accepted" || s === "preparing"
      ? "progress"
      : s === "ready"
        ? "ready"
        : null;
}

/** Day totals: counted orders exclude declined/cancelled. */
export function dayTotals(orders: Order[]) {
  const counted = orders.filter((o) => o.status !== "declined" && o.status !== "cancelled");
  return {
    count: counted.length,
    revenue: Math.round(counted.reduce((n, o) => n + o.subtotal, 0) * 1000) / 1000,
    unpaid: counted.filter((o) => !o.isPaid).length,
  };
}

/** Distances the owner can choose for table orders (metres; the database allows 50–500). */
export const ORDER_RADII = [50, 100, 150, 200, 300, 500] as const;
