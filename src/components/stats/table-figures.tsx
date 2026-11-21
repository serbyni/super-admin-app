"use client";

import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/icon";
import { formatPrice } from "@/lib/menu/schema";
import type { TablesSales } from "@/lib/stats/page-schemas";

/** Scans per day as a tiny line (2px, primary), last day marked. */
export function Sparkline({ series, label }: { series: number[]; label: string }) {
  if (series.length < 2) return null;
  const max = Math.max(...series, 1);
  const x = (i: number) => (i / (series.length - 1)) * 100;
  const y = (v: number) => 22 - (v / max) * 20;
  const last = series.length - 1;
  return (
    <span role="img" aria-label={label} className="relative block h-6 w-full" dir="ltr">
      <svg viewBox="0 0 100 24" preserveAspectRatio="none" className="h-6 w-full text-primary">
        <line
          x1="0"
          x2="100"
          y1="23"
          y2="23"
          className="stroke-surface-container-high"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        <polyline
          points={series.map((v, i) => `${x(i)},${y(series[i])}`).join(" ")}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span
        aria-hidden="true"
        className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-surface-container-lowest"
        style={{ left: `${x(last)}%`, top: `${(y(series[last]) / 24) * 100}%` }}
      />
    </span>
  );
}

/** "12 scans · 5 orders · 62.500 TND", sparkline, and a warning when an active table got no scan. */
export function TableFigures({
  figures,
  currency,
  active,
}: {
  figures: TablesSales["tables"][string] | undefined;
  currency: string;
  active: boolean;
}) {
  const t = useTranslations("stats.tables");
  const f = figures ?? { scans: 0, orders: 0, revenue: 0, series: [] };
  return (
    <span className="flex flex-col gap-xs">
      <span className="text-caption text-on-surface-variant">
        {t("scansCount", { count: f.scans })} · {t("orders", { count: f.orders })}
        {f.revenue ? (
          <>
            {" · "}
            <span dir="ltr">{formatPrice(f.revenue, currency)}</span>
          </>
        ) : null}
      </span>
      {f.scans ? (
        <Sparkline series={f.series} label={t("sparkline", { total: f.scans })} />
      ) : active ? (
        <span className="bg-warning-container text-on-warning-container flex w-fit items-center gap-xs rounded-full px-sm text-caption font-semibold">
          <Icon name="warning" className="text-icon-sm" />
          {t("noScans")}
        </span>
      ) : null}
    </span>
  );
}
