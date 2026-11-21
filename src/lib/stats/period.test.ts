import { describe, expect, it } from "vitest";
import { addDays, delta, resolvePeriod, todayIn } from "./period";

const today = "2026-11-21";

describe("resolvePeriod", () => {
  it("defaults to the last 7 days", () => {
    expect(resolvePeriod({}, today)).toEqual({
      key: "7d",
      from: "2026-11-15",
      to: today,
      prevFrom: "2026-11-08",
      prevTo: "2026-11-14",
      days: 7,
      hourly: false,
    });
  });

  it("today is hourly and compares with yesterday", () => {
    const p = resolvePeriod({ period: "today" }, today);
    expect(p).toMatchObject({ from: today, to: today, prevFrom: "2026-11-20", hourly: true });
  });

  it("30 days", () => {
    const p = resolvePeriod({ period: "30d" }, today);
    expect(p).toMatchObject({ from: "2026-10-23", prevFrom: "2026-09-23", prevTo: "2026-10-22" });
    expect(p.days).toBe(30);
  });

  it("custom range (swapped dates are put in order)", () => {
    const p = resolvePeriod({ period: "custom", from: "2026-11-10", to: "2026-11-01" }, today);
    expect(p).toMatchObject({ key: "custom", from: "2026-11-01", to: "2026-11-10", days: 10 });
    expect(p.prevFrom).toBe("2026-10-22");
  });

  it("invalid, future or too long custom ranges fall back to 7 days", () => {
    for (const q of [
      { period: "custom", from: "nope", to: today },
      { period: "custom", from: "2026-02-30", to: today },
      { period: "custom", from: "2024-01-01", to: today },
      { period: "custom", from: today, to: "2026-12-01" },
      { period: "year" },
    ])
      expect(resolvePeriod(q, today).key).toBe("7d");
  });

  it("crosses month and year ends", () => {
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
});

describe("delta / todayIn", () => {
  it("% change, null without a previous value", () => {
    expect(delta(15, 10)).toBe(50);
    expect(delta(5, 10)).toBe(-50);
    expect(delta(5, 0)).toBeNull();
  });

  it("today in the café's time zone", () => {
    const now = new Date("2026-11-21T23:30:00Z");
    expect(todayIn("Africa/Tunis", now)).toBe("2026-11-22");
    expect(todayIn("America/New_York", now)).toBe("2026-11-21");
  });
});
