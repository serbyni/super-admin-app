import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";

/*
 * Hand-made chart pieces for the dashboard statistics (server components, theme tokens only).
 * One hue (primary) everywhere: magnitude = bar length or cell darkness. Hover/focus shows the
 * exact values; every chart also has its figures in a table (see the section).
 */

/** Row of stat tiles at the top of a page. */
export function StatStrip({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <dl aria-label={label} className="grid grid-cols-2 gap-sm lg:grid-cols-4">
      {children}
    </dl>
  );
}

/** Stat tile: label · value · signed change vs the previous period (colour = good or bad). */
export function KpiTile({
  label,
  value,
  change,
  upIsGood = true,
  sub,
  noPrevious = "",
  alert = false,
}: {
  label: string;
  value: string;
  /** % vs the previous period; null = nothing to compare; undefined = no change line (live figures). */
  change?: number | null;
  upIsGood?: boolean;
  sub?: string;
  noPrevious?: string;
  /** Value needs attention (shown in the error colour, with the label read out). */
  alert?: boolean;
}) {
  const rounded = change === null || change === undefined ? null : Math.round(change);
  const good = rounded !== null && (rounded === 0 || rounded > 0 === upIsGood);
  return (
    <div className="flex flex-col gap-xs rounded-xl bg-surface-container-lowest p-md shadow-sm">
      <dt className="text-caption text-on-surface-variant">{label}</dt>
      <dd className={`text-headline-md font-bold ${alert ? "text-error" : "text-on-surface"}`}>
        {alert ? <Icon name="warning" className="me-xs text-icon-lg" /> : null}
        <span dir="ltr">{value}</span>
      </dd>
      {change === undefined ? null : (
        <dd
          className={`flex items-center gap-xs text-caption font-semibold ${
            rounded === null ? "text-on-surface-variant" : good ? "text-success" : "text-error"
          }`}
        >
          {rounded === null ? (
            noPrevious
          ) : (
            <>
              <Icon
                name={rounded > 0 ? "trending_up" : rounded < 0 ? "trending_down" : "trending_flat"}
                className="text-icon-md"
              />
              <span dir="ltr">
                {rounded > 0 ? "+" : ""}
                {rounded}%
              </span>
            </>
          )}
        </dd>
      )}
      {sub ? <dd className="text-caption text-on-surface-variant">{sub}</dd> : null}
    </div>
  );
}

export type Column = {
  key: string;
  label: string;
  showLabel: boolean;
  value: number;
  tip: string[];
};

/**
 * Column chart (one series): ≤24px columns on a hairline baseline, 2px gaps, 4px rounded tops,
 * max value on a top gridline. Each column is focusable and shows its tooltip on hover/focus.
 */
export function ColumnChart({
  columns,
  maxLabel,
  label,
}: {
  columns: Column[];
  maxLabel: string;
  label: string;
}) {
  const max = Math.max(...columns.map((c) => c.value), 0);
  return (
    <figure aria-label={label} dir="ltr" className="flex flex-col gap-xs">
      <div className="relative h-48 border-b border-outline-variant">
        <span className="absolute inset-x-0 top-0 border-t border-surface-container-high" />
        <span className="absolute top-0 left-0 -translate-y-full pb-xs text-caption text-on-surface-variant tabular-nums">
          {maxLabel}
        </span>
        <div className="absolute inset-0 flex items-end gap-0.5 pt-md">
          {columns.map((c, i) => (
            <div
              key={c.key}
              tabIndex={0}
              aria-label={c.tip.join(" · ")}
              className="group relative flex h-full flex-1 items-end justify-center outline-none"
            >
              <span
                className="w-full max-w-6 rounded-t-sm bg-primary transition-opacity group-hover:opacity-80 group-focus-visible:opacity-80"
                style={{ height: max ? `${(c.value / max) * 100}%` : "0%" }}
              />
              <span
                role="tooltip"
                className={`pointer-events-none invisible absolute bottom-full z-10 mb-xs flex min-w-max ${
                  // Keep the box inside the chart: anchored to the nearest edge.
                  i < columns.length / 3
                    ? "left-0"
                    : i >= (columns.length * 2) / 3
                      ? "right-0"
                      : "left-1/2 -translate-x-1/2"
                } flex-col rounded-lg bg-inverse-surface px-sm py-xs text-caption text-inverse-on-surface shadow-card-warm group-hover:visible group-focus-visible:visible`}
              >
                <span className="font-bold">{c.tip[1]}</span>
                <span>{c.tip[0]}</span>
                {c.tip[2] ? <span>{c.tip[2]}</span> : null}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-0.5" aria-hidden="true">
        {columns.map((c) => (
          <span
            key={c.key}
            className="flex-1 overflow-visible text-center text-caption whitespace-nowrap text-on-surface-variant tabular-nums"
          >
            {c.showLabel ? c.label : ""}
          </span>
        ))}
      </div>
    </figure>
  );
}

/** Ranked list: name + value on one line, a thin bar (share of the top value) below. */
export function RankBars({
  rows,
}: {
  rows: { key: string; name: string; value: number; valueLabel: string; sub?: string }[];
}) {
  const max = Math.max(...rows.map((r) => r.value), 0);
  return (
    <ol className="flex flex-col gap-sm">
      {rows.map((r) => (
        <li key={r.key} className="flex flex-col gap-xs">
          <span className="flex items-baseline justify-between gap-sm text-body-sm">
            <span className="min-w-0 truncate font-semibold text-on-surface" dir="auto">
              {r.name}
              {r.sub ? (
                <span className="font-normal text-on-surface-variant"> · {r.sub}</span>
              ) : null}
            </span>
            <span className="shrink-0 text-on-surface tabular-nums" dir="ltr">
              {r.valueLabel}
            </span>
          </span>
          <span className="block h-2 rounded-full bg-surface-container">
            <span
              className="block h-2 rounded-full bg-primary"
              style={{ width: max ? `${Math.max((r.value / max) * 100, 2)}%` : "0%" }}
            />
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Two-part bar (tall segmented bar): each part its own block with its share printed inside,
 * 2px gap, legend below with name and figures. Dark part = primary, light part = its tint.
 */
export function SplitBar({ parts, label }: { parts: [SplitPart, SplitPart]; label: string }) {
  const total = parts[0].value + parts[1].value;
  const styles = ["bg-primary text-on-primary", "bg-primary/40 text-on-surface"];
  return (
    <figure aria-label={label} className="flex flex-col gap-sm">
      <div className="flex h-7 gap-0.5">
        {parts.map((p, i) =>
          p.value ? (
            <span
              key={p.name}
              title={`${p.name}: ${p.share} · ${p.detail}`}
              className={`flex items-center overflow-visible rounded-sm px-xs text-caption font-bold ${styles[i]}`}
              style={{ width: `${(p.value / total) * 100}%` }}
            >
              {p.value / total >= 0.12 ? p.share : ""}
            </span>
          ) : null,
        )}
      </div>
      <ul className="flex flex-wrap gap-x-lg gap-y-xs text-body-sm">
        {parts.map((p, i) => (
          <li key={p.name} className="flex flex-wrap items-center gap-x-xs">
            <span
              className={`h-3 w-3 shrink-0 rounded-sm ${styles[i].split(" ")[0]}`}
              aria-hidden="true"
            />
            <span className="font-semibold whitespace-nowrap text-on-surface">{p.name}</span>
            <span className="text-on-surface-variant">
              {p.share} · {p.detail}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
export type SplitPart = { name: string; value: number; share: string; detail: string };

const LEVELS = ["bg-primary/10", "bg-primary/30", "bg-primary/50", "bg-primary/70", "bg-primary"];

/** Weekday × hour heatmap (one hue, 5 steps). `cells[day][hour]` = orders. */
export function Heatmap({
  days,
  hours,
  cells,
  cellLabel,
  fewer,
  more,
  label,
}: {
  days: string[];
  hours: number[];
  cells: number[][];
  cellLabel: (day: number, hour: number, n: number) => string;
  fewer: string;
  more: string;
  label: string;
}) {
  const max = Math.max(...cells.flat(), 0);
  const level = (n: number) =>
    LEVELS[Math.min(LEVELS.length - 1, Math.ceil((n / max) * LEVELS.length) - 1)];
  const grid = { gridTemplateColumns: `auto repeat(${hours.length}, minmax(0, 1fr))` };
  return (
    <figure aria-label={label} className="flex flex-col gap-sm" dir="ltr">
      <div className="grid gap-0.5" style={grid}>
        <span />
        {hours.map((h) => (
          <span key={h} className="text-center text-caption text-on-surface-variant tabular-nums">
            {h % 2 === hours[0] % 2 ? h : ""}
          </span>
        ))}
        {days.map((d, di) => (
          <Row key={d}>
            <span className="pe-xs text-end text-caption text-on-surface-variant">{d}</span>
            {hours.map((h) => {
              const n = cells[di][h];
              const text = cellLabel(di, h, n);
              return (
                <span
                  key={h}
                  title={text}
                  aria-label={text}
                  role="img"
                  className={`h-6 rounded-sm ${n ? level(n) : "bg-surface-container"}`}
                />
              );
            })}
          </Row>
        ))}
      </div>
      <div className="flex items-center gap-xs self-end text-caption text-on-surface-variant">
        {fewer}
        {LEVELS.map((l) => (
          <span key={l} className={`h-3 w-4 rounded-sm ${l}`} aria-hidden="true" />
        ))}
        {more}
      </div>
    </figure>
  );
}

const Row = ({ children }: { children: ReactNode }) => <>{children}</>;
