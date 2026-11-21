import { describe, expect, it } from "vitest";
import { liveFigures } from "./live";
import type { Order } from "./schema";

const at = (m: number) => new Date(Date.UTC(2026, 10, 21, 10, m)).toISOString();
const o = (status: Order["status"], created: number, accepted?: number) =>
  ({
    status,
    createdAt: at(created),
    acceptedAt: accepted === undefined ? null : at(accepted),
  }) as Order;

describe("liveFigures", () => {
  it("counts open orders, oldest new order and average accept time", () => {
    const active = [o("new", 10), o("new", 4), o("accepted", 0, 2), o("ready", 1, 4)];
    const today = [...active, o("served", 0, 6)];
    const f = liveFigures(active, today, Date.parse(at(20)));
    expect(f.open).toEqual({ new: 2, accepted: 1, preparing: 0, ready: 1 });
    expect(f.oldestNewMin).toBe(16);
    expect(f.avgAcceptMin).toBeCloseTo((2 + 3 + 6) / 3);
  });

  it("nothing waiting", () => {
    const f = liveFigures([], [], Date.now());
    expect(f.oldestNewMin).toBeNull();
    expect(f.avgAcceptMin).toBeNull();
  });
});
