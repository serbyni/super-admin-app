import { describe, expect, it } from "vitest";
import { pointAtOffset } from "./mercator";

describe("pointAtOffset", () => {
  it("returns the centre for a zero offset", () => {
    const p = pointAtOffset({ lat: 36.8, lng: 10.18 }, 15, 0, 0);
    expect(p.lat).toBeCloseTo(36.8, 6);
    expect(p.lng).toBeCloseTo(10.18, 6);
  });

  it("moves east / north for right / up offsets", () => {
    const c = { lat: 36.8, lng: 10.18 };
    const east = pointAtOffset(c, 15, 100, 0);
    const north = pointAtOffset(c, 15, 0, -100);
    expect(east.lng).toBeGreaterThan(c.lng);
    expect(east.lat).toBeCloseTo(c.lat, 6);
    expect(north.lat).toBeGreaterThan(c.lat);
  });

  it("matches the known scale at zoom 0 (256px = 360°)", () => {
    const p = pointAtOffset({ lat: 0, lng: 0 }, 0, 64, 0);
    expect(p.lng).toBeCloseTo(90, 6);
  });
});
