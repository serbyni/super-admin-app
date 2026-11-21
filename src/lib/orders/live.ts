import type { Order } from "./schema";

/** Live figures of the board: open orders per step, oldest waiting new order, average accept time today. */
export type LiveFigures = {
  open: { new: number; accepted: number; preparing: number; ready: number };
  /** Minutes the oldest "new" order has been waiting, or null. */
  oldestNewMin: number | null;
  /** Average minutes from order to "accepted", over today's accepted orders, or null. */
  avgAcceptMin: number | null;
};

const MIN = 60_000;

export function liveFigures(active: Order[], today: Order[], now: number): LiveFigures {
  const open = { new: 0, accepted: 0, preparing: 0, ready: 0 };
  let oldest: number | null = null;
  for (const o of active) {
    if (o.status in open) open[o.status as keyof typeof open]++;
    if (o.status === "new") {
      const at = Date.parse(o.createdAt);
      if (oldest === null || at < oldest) oldest = at;
    }
  }
  const waits = today
    .filter((o) => o.acceptedAt)
    .map((o) => (Date.parse(o.acceptedAt!) - Date.parse(o.createdAt)) / MIN);
  return {
    open,
    oldestNewMin: oldest === null ? null : Math.max(0, Math.floor((now - oldest) / MIN)),
    avgAcceptMin: waits.length ? waits.reduce((a, b) => a + b, 0) / waits.length : null,
  };
}
