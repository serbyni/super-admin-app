import { describe, expect, it } from "vitest";
import { defaultHours, groupHours, hoursSchema, parseHours } from "./hours";

describe("opening hours", () => {
  it("default: Mon–Fri 08:00–20:00, weekend 09:00–20:00", () => {
    expect(groupHours(defaultHours())).toEqual([
      { days: "Monday – Friday", hours: "08:00 – 20:00" },
      { days: "Saturday – Sunday", hours: "09:00 – 20:00" },
    ]);
  });

  it("groups consecutive days, closed days included", () => {
    const h = defaultHours();
    h[6] = { closed: true, open: "09:00", close: "20:00" };
    expect(
      groupHours(h, { days: ["L", "M", "M", "J", "V", "S", "D"], closed: "Fermé" }).at(-1),
    ).toEqual({ days: "D", hours: "Fermé" });
  });

  it("validates: 7 days, HH:MM, open ≠ close (closing after midnight allowed)", () => {
    const h = defaultHours();
    expect(hoursSchema.safeParse(h).success).toBe(true);
    expect(hoursSchema.safeParse(h.slice(0, 6)).success).toBe(false);
    h[4] = { closed: false, open: "18:00", close: "02:00" };
    expect(hoursSchema.safeParse(h).success).toBe(true);
    h[2] = { closed: false, open: "09:00", close: "09:00" };
    expect(hoursSchema.safeParse(h).success).toBe(false);
    h[2] = { closed: true, open: "09:00", close: "09:00" };
    expect(hoursSchema.safeParse(h).success).toBe(true);
    expect(parseHours([{ closed: false, open: "25:00", close: "20:00" }])).toBeNull();
    expect(parseHours(null)).toBeNull();
  });
});
