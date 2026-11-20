import { describe, expect, it } from "vitest";
import { columnOf, dayTotals, nextStatus, type Order } from "./schema";

const order = (status: Order["status"], subtotal: number, isPaid = false): Order => ({
  id: "x",
  number: 1,
  kind: "table",
  tableLabel: "T1",
  customerName: "",
  note: "",
  status,
  declineReason: "",
  subtotal,
  currency: "TND",
  isPaid,
  locale: "fr",
  createdAt: "2026-11-20T10:00:00Z",
  acceptedAt: null,
  readyAt: null,
  servedAt: null,
  closedAt: null,
  items: [],
});

describe("order flow", () => {
  it("moves forward step by step", () => {
    expect(nextStatus("new")).toBe("accepted");
    expect(nextStatus("accepted")).toBe("preparing");
    expect(nextStatus("ready")).toBe("served");
    expect(nextStatus("served")).toBeNull();
    expect(nextStatus("declined")).toBeNull();
  });
  it("puts open orders in board columns", () => {
    expect(columnOf("new")).toBe("new");
    expect(columnOf("preparing")).toBe("progress");
    expect(columnOf("ready")).toBe("ready");
    expect(columnOf("served")).toBeNull();
  });
  it("totals a day without declined / cancelled orders", () => {
    const t = dayTotals([
      order("served", 12, true),
      order("ready", 4.5),
      order("declined", 99),
      order("cancelled", 3),
    ]);
    expect(t).toEqual({ count: 2, revenue: 16.5, unpaid: 1 });
  });
});
