"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Icon } from "@/components/ui/icon";
import {
  chairs,
  clampToArea,
  footprint,
  normalizeRotation,
  overlapping,
  snap,
} from "@/lib/tables/geometry";
import type { Area, CafeTable } from "@/lib/tables/schema";

/*
 * Top-down floor plan of one area. The SVG viewBox is in METRES (0 0 width depth), so pointer
 * positions convert to metres with the SVG's screen matrix. Tables: drag (mouse/touch/pen), arrow
 * keys (Shift = 50 cm), R / Shift+R to rotate. Changes stay local until "Save layout".
 * The parent remounts it (key) when the saved positions change, so it always starts from them.
 */

export type Placement = { id: string; x: number; y: number; rotation: number };

type Props = {
  area: Area;
  tables: CafeTable[];
  saving: boolean;
  onSave: (layout: Placement[]) => void;
  /** Opens the table's details (edit dialog). */
  onOpen: (table: CafeTable) => void;
  /** Tells the parent whether there are unsaved moves (to warn before leaving). */
  onDirtyChange?: (dirty: boolean) => void;
};

const SNAP = 0.25;
const NUDGE = 0.1;
const pos = (t: CafeTable): Placement => ({ id: t.id, x: t.x, y: t.y, rotation: t.rotation });

export function FloorEditor({ area, tables, saving, onSave, onOpen, onDirtyChange }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const saved = useMemo(() => Object.fromEntries(tables.map((t) => [t.id, pos(t)])), [tables]);
  const [layout, setLayout] = useState<Record<string, Placement>>(saved);
  const [selected, setSelected] = useState<string | null>(null);
  const [snapOn, setSnapOn] = useState(true);
  const drag = useRef<{ id: string; dx: number; dy: number; pointer: number } | null>(null);

  const dirty = tables.some((t) => {
    const a = layout[t.id];
    return a && (a.x !== t.x || a.y !== t.y || a.rotation !== t.rotation);
  });
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const placed = tables.map((t) => ({ ...t, ...(layout[t.id] ?? pos(t)) }));
  const clash = overlapping(placed);
  const sel = placed.find((t) => t.id === selected) ?? null;

  const move = (id: string, x: number, y: number) =>
    setLayout((l) => {
      const step = snapOn ? SNAP : 0;
      const c = clampToArea(snap(x, step), snap(y, step), area);
      return { ...l, [id]: { ...l[id], x: c.x, y: c.y } };
    });
  const rotate = (id: string, by: number) =>
    setLayout((l) => ({
      ...l,
      [id]: { ...l[id], rotation: normalizeRotation(l[id].rotation + by) },
    }));

  /** Pointer position in metres. */
  const toMetres = (e: PointerEvent) => {
    const m = svg.current?.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };

  const onPointerDown = (e: PointerEvent<SVGGElement>, t: (typeof placed)[number]) => {
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const p = toMetres(e);
    drag.current = { id: t.id, dx: p.x - t.x, dy: p.y - t.y, pointer: e.pointerId };
    setSelected(t.id);
  };
  const onPointerMove = (e: PointerEvent<SVGGElement>) => {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    const p = toMetres(e);
    move(d.id, p.x - d.dx, p.y - d.dy);
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  const onKey = (e: KeyboardEvent<SVGGElement>, t: (typeof placed)[number]) => {
    const step = e.shiftKey ? 0.5 : NUDGE;
    const keys: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (keys[e.key]) {
      e.preventDefault();
      const [dx, dy] = keys[e.key];
      setLayout((l) => {
        const c = clampToArea(snap(l[t.id].x + dx, 0), snap(l[t.id].y + dy, 0), area);
        return { ...l, [t.id]: { ...l[t.id], ...c } };
      });
    } else if (e.key === "r" || e.key === "R") {
      e.preventDefault();
      rotate(t.id, e.shiftKey ? -15 : 15);
    } else if (e.key === "Enter") {
      e.preventDefault();
      onOpen(t);
    } else if (e.key === "Escape") {
      setSelected(null);
    }
  };

  // Grid: thin lines every 50 cm, stronger every metre.
  const grid = [];
  for (let x = 0.5; x < area.widthM; x += 0.5)
    grid.push(
      <line
        key={`x${x}`}
        x1={x}
        y1={0}
        x2={x}
        y2={area.depthM}
        className={Number.isInteger(x) ? "stroke-outline-variant" : "stroke-surface-container-high"}
        strokeWidth={0.015}
      />,
    );
  for (let y = 0.5; y < area.depthM; y += 0.5)
    grid.push(
      <line
        key={`y${y}`}
        x1={0}
        y1={y}
        x2={area.widthM}
        y2={y}
        className={Number.isInteger(y) ? "stroke-outline-variant" : "stroke-surface-container-high"}
        strokeWidth={0.015}
      />,
    );

  return (
    <div className="flex flex-col gap-sm">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-sm">
        <div className="flex flex-wrap items-center gap-xs text-body-sm">
          {sel ? (
            <>
              <span className="font-semibold text-on-surface">{sel.label}</span>
              <span className="text-on-surface-variant">
                {sel.x.toFixed(2)} m, {sel.y.toFixed(2)} m · {sel.rotation}°
              </span>
              <ToolButton
                icon="rotate_left"
                label="Rotate left 15°"
                onClick={() => rotate(sel.id, -15)}
              />
              <ToolButton
                icon="rotate_right"
                label="Rotate right 15°"
                onClick={() => rotate(sel.id, 15)}
              />
              <ToolButton icon="edit" label={`Edit ${sel.label}`} onClick={() => onOpen(sel)} />
            </>
          ) : (
            <span className="text-on-surface-variant">
              Drag tables to place them. Select one to rotate it — or use the arrow keys and R.
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-sm">
          <label className="flex items-center gap-xs text-body-sm text-on-surface-variant">
            <input
              type="checkbox"
              checked={snapOn}
              onChange={(e) => setSnapOn(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            Snap to 25 cm
          </label>
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={() => setLayout(saved)}
            className="rounded-xl px-md py-sm text-body-sm font-semibold text-on-surface-variant hover:bg-surface-container disabled:opacity-50"
          >
            Undo changes
          </button>
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={() =>
              onSave(Object.values(layout).filter((p) => tables.some((t) => t.id === p.id)))
            }
            className="inline-flex items-center gap-xs rounded-xl bg-primary px-md py-sm text-body-sm font-semibold text-on-primary shadow-button-warm hover:bg-primary-container disabled:opacity-60"
          >
            <Icon
              name={saving ? "progress_activity" : "save"}
              className={`text-icon-md ${saving ? "animate-spin" : ""}`}
            />
            {dirty ? "Save layout" : "Layout saved"}
          </button>
        </div>
      </div>

      {clash.size ? (
        <p role="status" className="flex items-center gap-xs text-body-sm text-error">
          <Icon name="warning" className="text-icon-md" /> Some tables overlap — move them apart.
        </p>
      ) : null}

      {/* Floor */}
      <div className="overflow-x-auto rounded-xl border border-outline-variant bg-surface-container-lowest">
        <svg
          ref={svg}
          viewBox={`-0.3 -0.3 ${area.widthM + 0.6} ${area.depthM + 0.6}`}
          className="block h-auto w-full min-w-2xl touch-none select-none"
          role="application"
          aria-label={`Floor plan of ${area.name}, ${area.widthM} by ${area.depthM} metres`}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) setSelected(null);
          }}
        >
          <rect
            x={0}
            y={0}
            width={area.widthM}
            height={area.depthM}
            className="fill-surface-container-low stroke-outline"
            strokeWidth={0.04}
            rx={0.08}
          />
          {grid}
          {/* Selected table drawn last, so it is never hidden under another one. */}
          {[
            ...placed.filter((t) => t.id !== selected),
            ...placed.filter((t) => t.id === selected),
          ].map((t) => {
            const f = footprint(t.shape, t.seats);
            const isSel = t.id === selected;
            const bad = clash.has(t.id);
            const top = bad
              ? "fill-error-container stroke-error"
              : isSel
                ? "fill-secondary-container stroke-primary"
                : "fill-surface-container-lowest stroke-outline";
            return (
              <g
                key={t.id}
                role="button"
                tabIndex={0}
                aria-label={`${t.label}, ${t.seats} seats, at ${t.x.toFixed(1)} by ${t.y.toFixed(1)} metres, rotated ${t.rotation} degrees${bad ? ", overlaps another table" : ""}`}
                aria-pressed={isSel}
                transform={`translate(${t.x} ${t.y}) rotate(${t.rotation})`}
                className={`cursor-grab focus:outline-none active:cursor-grabbing ${t.isActive ? "" : "opacity-50"}`}
                onPointerDown={(e) => onPointerDown(e, t)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onFocus={() => setSelected(t.id)}
                onKeyDown={(e) => onKey(e, t)}
                onDoubleClick={() => onOpen(t)}
              >
                {chairs(t.shape, t.seats).map((c, i) => (
                  <rect
                    key={i}
                    x={c.x - 0.2}
                    y={c.y - 0.18}
                    width={0.4}
                    height={0.36}
                    rx={0.1}
                    transform={`rotate(${c.angle} ${c.x} ${c.y})`}
                    className="fill-surface-container-highest stroke-outline-variant"
                    strokeWidth={0.02}
                  />
                ))}
                {f.round ? (
                  <circle r={f.w / 2} className={top} strokeWidth={isSel ? 0.05 : 0.03} />
                ) : (
                  <rect
                    x={-f.w / 2}
                    y={-f.d / 2}
                    width={f.w}
                    height={f.d}
                    rx={0.06}
                    className={top}
                    strokeWidth={isSel ? 0.05 : 0.03}
                  />
                )}
                {/* Label stays upright whatever the table's rotation. */}
                <text
                  transform={`rotate(${-t.rotation})`}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={Math.min(0.32, f.w / 2.6)}
                  fontWeight={700}
                  className="pointer-events-none fill-on-surface"
                >
                  {t.label}
                </text>
                {isSel ? (
                  <circle
                    r={Math.max(f.w, f.d) / 2 + 0.45}
                    className="fill-none stroke-primary"
                    strokeWidth={0.02}
                    strokeDasharray="0.08 0.08"
                  />
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
      <p className="text-caption text-on-surface-variant">
        {area.name}: {area.widthM} × {area.depthM} m · grid 50 cm. Double-click a table (or press
        Enter) to edit it.
      </p>
    </div>
  );
}

function ToolButton({
  icon,
  label,
  onClick,
}: {
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container"
    >
      <Icon name={icon} className="text-icon-lg" />
    </button>
  );
}
