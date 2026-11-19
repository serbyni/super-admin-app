import { describe, expect, it } from "vitest";
import {
  bounds,
  chairs,
  clampToArea,
  footprint,
  normalizeRotation,
  overlapping,
  snap,
} from "./geometry";

describe("floor geometry", () => {
  it("sizes tables by shape and seats", () => {
    expect(footprint("square", 4)).toEqual({ w: 0.8, d: 0.8, round: false });
    expect(footprint("square", 6).w).toBe(1.1);
    expect(footprint("round", 2).w).toBe(0.7);
    expect(footprint("rect", 8).w).toBeCloseTo(2.4);
    expect(footprint("bar", 1).round).toBe(true);
  });

  it("places one chair per seat", () => {
    for (const shape of ["square", "round", "rect", "bar"] as const)
      for (const seats of [1, 2, 3, 4, 6, 9])
        expect(chairs(shape, seats), `${shape} ${seats}`).toHaveLength(seats);
  });

  it("snaps, clamps and normalises", () => {
    expect(snap(1.13, 0.25)).toBe(1.25);
    expect(snap(1.13, 0)).toBe(1.13);
    expect(clampToArea(-1, 9, { widthM: 10, depthM: 6 })).toEqual({ x: 0, y: 6 });
    expect(normalizeRotation(-90)).toBe(270);
    expect(normalizeRotation(450)).toBe(90);
  });

  it("rotates bounding boxes and finds overlaps", () => {
    const long = { id: "a", shape: "rect" as const, seats: 6, x: 5, y: 5, rotation: 90 };
    const b = bounds(long);
    expect(b.maxY - b.minY).toBeCloseTo(1.8);
    expect(b.maxX - b.minX).toBeCloseTo(0.8);
    const near = { id: "b", shape: "square" as const, seats: 2, x: 5, y: 6.2, rotation: 0 };
    const far = { id: "c", shape: "square" as const, seats: 2, x: 8, y: 1, rotation: 0 };
    expect([...overlapping([long, near, far])].sort()).toEqual(["a", "b"]);
  });
});
