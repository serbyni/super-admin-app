import type { TableShape } from "./schema";

/*
 * Floor geometry shared by the 2D editor and the 3D view. Units are METRES; a table's (x, y) is
 * its CENTRE, measured from the area's top-left corner; rotation in degrees, clockwise.
 */

export type Footprint = { w: number; d: number; round: boolean };

const clampN = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/** Table top size from its shape and seats (realistic café furniture sizes). */
export function footprint(shape: TableShape, seats: number): Footprint {
  switch (shape) {
    case "round": {
      const dia = clampN(0.5 + seats * 0.1, 0.6, 1.6);
      return { w: dia, d: dia, round: true };
    }
    case "bar":
      return { w: 0.6, d: 0.6, round: true };
    case "rect":
      return { w: clampN(Math.ceil(seats / 2) * 0.6, 1.2, 4), d: 0.8, round: false };
    case "square":
    default:
      return seats <= 4 ? { w: 0.8, d: 0.8, round: false } : { w: 1.1, d: 1.1, round: false };
  }
}

export type Chair = { x: number; y: number; angle: number };

/** Chair centres relative to the table centre (before the table's rotation). */
export function chairs(shape: TableShape, seats: number): Chair[] {
  const f = footprint(shape, seats);
  const gap = 0.32; // chair centre distance from the table edge
  if (f.round) {
    const r = f.w / 2 + gap;
    return Array.from({ length: seats }, (_, i) => {
      const a = (i / seats) * Math.PI * 2 - Math.PI / 2;
      return { x: Math.cos(a) * r, y: Math.sin(a) * r, angle: (a * 180) / Math.PI + 90 };
    });
  }
  if (shape === "square" && seats <= 4) {
    const sides = [
      { x: 0, y: -(f.d / 2 + gap), angle: 0 },
      { x: 0, y: f.d / 2 + gap, angle: 180 },
      { x: -(f.w / 2 + gap), y: 0, angle: 270 },
      { x: f.w / 2 + gap, y: 0, angle: 90 },
    ];
    return sides.slice(0, seats);
  }
  // Long sides first, evenly spread; extra chairs at the ends.
  const ends = shape === "square" ? 0 : Math.max(0, seats - 2 * Math.floor(f.w / 0.6));
  const perSide = Math.ceil((seats - Math.min(ends, 2)) / 2);
  const out: Chair[] = [];
  for (const [side, n] of [
    [-1, perSide],
    [1, seats - Math.min(ends, 2) - perSide],
  ] as const) {
    for (let i = 0; i < n; i++) {
      const x = -f.w / 2 + (f.w * (i + 0.5)) / n;
      out.push({ x, y: side * (f.d / 2 + gap), angle: side < 0 ? 0 : 180 });
    }
  }
  if (ends >= 1) out.push({ x: -(f.w / 2 + gap), y: 0, angle: 270 });
  if (ends >= 2) out.push({ x: f.w / 2 + gap, y: 0, angle: 90 });
  return out;
}

/** Rounds to the snap step (e.g. 0.25 m); step 0 = no snapping (centimetre precision). */
export function snap(v: number, step: number): number {
  const s = step > 0 ? step : 0.01;
  return Math.round(Math.round(v / s) * s * 100) / 100;
}

/** Keeps a table centre inside its area. */
export function clampToArea(x: number, y: number, area: { widthM: number; depthM: number }) {
  return { x: clampN(x, 0, area.widthM), y: clampN(y, 0, area.depthM) };
}

export const normalizeRotation = (deg: number) => ((Math.round(deg) % 360) + 360) % 360;

type Placed = {
  id: string;
  shape: TableShape;
  seats: number;
  x: number;
  y: number;
  rotation: number;
};

/** Axis-aligned bounding box of a rotated table top (metres, absolute). */
export function bounds(t: Placed) {
  const f = footprint(t.shape, t.seats);
  const a = (t.rotation * Math.PI) / 180;
  const hw = f.round ? f.w / 2 : (Math.abs(Math.cos(a)) * f.w + Math.abs(Math.sin(a)) * f.d) / 2;
  const hd = f.round ? f.d / 2 : (Math.abs(Math.sin(a)) * f.w + Math.abs(Math.cos(a)) * f.d) / 2;
  return { minX: t.x - hw, maxX: t.x + hw, minY: t.y - hd, maxY: t.y + hd };
}

/** Ids of tables whose tops overlap another table (bounding boxes; good enough for a warning). */
export function overlapping(tables: Placed[]): Set<string> {
  const out = new Set<string>();
  const b = tables.map((t) => ({ id: t.id, ...bounds(t) }));
  for (let i = 0; i < b.length; i++)
    for (let j = i + 1; j < b.length; j++) {
      const p = b[i];
      const q = b[j];
      if (p.minX < q.maxX && q.minX < p.maxX && p.minY < q.maxY && q.minY < p.maxY) {
        out.add(p.id);
        out.add(q.id);
      }
    }
  return out;
}
