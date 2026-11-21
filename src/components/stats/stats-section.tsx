import { getTranslations } from "next-intl/server";
import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { formatLocale } from "@/config/locale";
import { serverApi } from "@/lib/data/server-api";
import { formatPrice } from "@/lib/menu/schema";
import { delta, resolvePeriod, todayIn, type Period } from "@/lib/stats/period";
import { averageTicket, type Stats } from "@/lib/stats/schema";
import { ColumnChart, Heatmap, KpiTile, RankBars, SplitBar, type Column } from "./charts";
import { PeriodBar } from "./period-bar";
import { RankTabs } from "./rank-tabs";

type Search = Record<string, string | string[] | undefined>;

/** Statistics block of the dashboard home: period bar, KPIs, charts. Reads ?period=&from=&to=. */
export async function StatsSection({
  slug,
  currency,
  timezone,
  locale,
  base,
  searchParams,
}: {
  slug: string;
  currency: string;
  timezone: string;
  locale: string;
  /** Dashboard URL without trailing slash. */
  base: string;
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const today = todayIn(timezone);
  const period = resolvePeriod(sp, today);
  const [t, s] = await Promise.all([
    getTranslations("stats"),
    serverApi().stats.get(slug, period.from, period.to),
  ]);
  const fl = formatLocale(locale);
  const day = (d: string, o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(fl, { ...o, timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
  const money = (n: number) => formatPrice(n, currency);
  const count = new Intl.NumberFormat(fl);
  const pct = new Intl.NumberFormat(fl, { style: "percent", maximumFractionDigits: 0 });
  const { totals: cur, previous: prev } = s;
  const nothing = cur.orders + cur.declined + cur.cancelled === 0;
  const noPrevious = t("noPrevious");

  return (
    <section aria-labelledby="stats-title" className="flex flex-col gap-md">
      <div className="flex flex-col gap-xs">
        <h2 id="stats-title" className="flex items-center gap-sm text-headline-md text-on-surface">
          <Icon name="monitoring" className="text-icon-xl text-primary" />
          {t("title")}
        </h2>
        <p className="text-body-sm text-on-surface-variant">{t("description")}</p>
      </div>

      <PeriodBar period={period} today={today} base={base} locale={locale} />

      <dl className="grid grid-cols-2 gap-sm lg:grid-cols-4">
        <KpiTile
          label={t("kpi.revenue")}
          value={money(cur.revenue)}
          change={delta(cur.revenue, prev.revenue)}
          sub={t("paidOf", { amount: money(cur.paidRevenue) })}
          noPrevious={noPrevious}
        />
        <KpiTile
          label={t("kpi.orders")}
          value={count.format(cur.orders)}
          change={delta(cur.orders, prev.orders)}
          sub={t("declinedCancelled", {
            declined: count.format(cur.declined),
            cancelled: count.format(cur.cancelled),
          })}
          noPrevious={noPrevious}
        />
        <KpiTile
          label={t("kpi.avgTicket")}
          value={money(averageTicket(cur))}
          change={delta(averageTicket(cur), averageTicket(prev))}
          noPrevious={noPrevious}
        />
        <KpiTile
          label={t("kpi.unpaid")}
          value={count.format(cur.unpaid)}
          change={delta(cur.unpaid, prev.unpaid)}
          upIsGood={false}
          sub={t("unpaidHint")}
          noPrevious={noPrevious}
        />
      </dl>

      {nothing ? (
        <div className="flex flex-col items-center gap-sm rounded-xl bg-surface-container-lowest p-xl text-center shadow-sm">
          <Icon name="bar_chart" className="text-icon-xl text-outline" />
          <p className="font-semibold text-on-surface">{t("empty")}</p>
          <p className="text-body-sm text-on-surface-variant">{t("emptyHint")}</p>
          <Link
            href={`${base}/orders`}
            className="inline-flex items-center gap-xs text-body-sm font-semibold text-primary"
          >
            {t("openOrders")}
            <Icon name="arrow_forward" className="text-icon-md" flipRtl />
          </Link>
        </div>
      ) : (
        <>
          <Trend s={s} period={period} t={t} day={day} money={money} count={count} />
          <div className="grid grid-cols-1 gap-md lg:grid-cols-2">
            <BestSellers s={s} t={t} money={money} count={count} pct={pct} />
            <BusyHours s={s} t={t} fl={fl} />
          </div>
          <div className="grid grid-cols-1 gap-md lg:grid-cols-3">
            <Channels s={s} t={t} money={money} count={count} pct={pct} />
            <Qr s={s} t={t} count={count} pct={pct} />
            <Timing s={s} t={t} count={count} />
          </div>
        </>
      )}
    </section>
  );
}

type T = Awaited<ReturnType<typeof getTranslations<"stats">>>;

function Card({ title, icon, children }: { title: string; icon: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-md rounded-xl bg-surface-container-lowest p-lg shadow-sm">
      <h3 className="flex items-center gap-sm text-body-lg font-semibold text-on-surface">
        <Icon name={icon} className="text-icon-lg text-primary" />
        {title}
      </h3>
      {children}
    </div>
  );
}

function Trend({
  s,
  period,
  t,
  day,
  money,
  count,
}: {
  s: Stats;
  period: Period;
  t: T;
  day: (d: string, o: Intl.DateTimeFormatOptions) => string;
  money: (n: number) => string;
  count: Intl.NumberFormat;
}) {
  const n = s.series.length;
  const step = s.hourly ? 3 : n <= 7 ? 1 : Math.ceil(n / 8);
  const when = (at: string) =>
    s.hourly ? `${at}:00` : day(at, { weekday: "short", day: "numeric", month: "short" });
  const columns: Column[] = s.series.map((b, i) => ({
    key: b.at,
    label: s.hourly
      ? b.at
      : n <= 7
        ? day(b.at, { weekday: "short", day: "numeric" })
        : day(b.at, { day: "numeric", month: n > 31 ? "numeric" : undefined }),
    showLabel: i % step === 0,
    value: b.revenue,
    tip: [when(b.at), money(b.revenue), t("orderCount", { count: b.orders })],
  }));
  const title = period.hourly ? t("trendHourly") : t("trendDaily");
  const max = Math.max(...s.series.map((b) => b.revenue), 0);
  return (
    <Card title={title} icon="show_chart">
      <div className="pt-md">
        <ColumnChart columns={columns} maxLabel={money(max)} label={title} />
      </div>
      <details className="text-body-sm">
        <summary className="cursor-pointer font-semibold text-primary">{t("showData")}</summary>
        <div className="mt-sm max-h-64 overflow-auto">
          <table className="w-full text-start">
            <thead className="text-caption text-on-surface-variant">
              <tr>
                <th className="py-xs text-start font-semibold">{t("colWhen")}</th>
                <th className="py-xs text-end font-semibold">{t("colOrders")}</th>
                <th className="py-xs text-end font-semibold">{t("colRevenue")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-high">
              {s.series.map((b) => (
                <tr key={b.at}>
                  <td className="py-xs">{when(b.at)}</td>
                  <td className="py-xs text-end tabular-nums">{count.format(b.orders)}</td>
                  <td className="py-xs text-end tabular-nums" dir="ltr">
                    {money(b.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </Card>
  );
}

function BestSellers({
  s,
  t,
  money,
  count,
  pct,
}: {
  s: Stats;
  t: T;
  money: (n: number) => string;
  count: Intl.NumberFormat;
  pct: Intl.NumberFormat;
}) {
  return (
    <Card title={t("best.title")} icon="local_cafe">
      <RankTabs
        tabs={[
          {
            id: "qty",
            label: t("best.byQuantity"),
            panel: (
              <RankBars
                rows={s.topByQuantity.map((r) => ({
                  key: r.name,
                  name: r.name,
                  value: r.quantity,
                  valueLabel: t("best.sold", { count: count.format(r.quantity) }),
                }))}
              />
            ),
          },
          {
            id: "rev",
            label: t("best.byRevenue"),
            panel: (
              <RankBars
                rows={s.topByRevenue.map((r) => ({
                  key: r.name,
                  name: r.name,
                  value: r.revenue,
                  valueLabel: money(r.revenue),
                }))}
              />
            ),
          },
        ]}
      />
      <div className="flex flex-col gap-sm border-t border-surface-container-high pt-md">
        <h4 className="text-body-sm font-semibold text-on-surface-variant">{t("best.options")}</h4>
        {s.topOptions.length ? (
          <RankBars
            rows={s.topOptions.map((o) => ({
              key: `${o.item}-${o.group}-${o.choice}`,
              name: o.choice ?? "—",
              sub: o.group ?? undefined,
              value: o.quantity,
              valueLabel: t("best.optionShare", { share: pct.format(o.share ?? 0), item: o.item }),
            }))}
          />
        ) : (
          <p className="text-body-sm text-on-surface-variant">{t("best.noOptions")}</p>
        )}
      </div>
    </Card>
  );
}

function BusyHours({ s, t, fl }: { s: Stats; t: T; fl: string }) {
  const cells = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  for (const c of s.heatmap) cells[c.day][c.hour] = c.orders;
  const used = s.heatmap.map((c) => c.hour);
  const lo = Math.max(0, Math.min(...used) - 1);
  const hi = Math.min(23, Math.max(...used) + 1);
  const hours = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  // 2024-01-01 was a Monday.
  const wd = new Intl.DateTimeFormat(fl, { weekday: "short", timeZone: "UTC" });
  const days = Array.from({ length: 7 }, (_, i) => wd.format(new Date(Date.UTC(2024, 0, 1 + i))));
  return (
    <Card title={t("busy.title")} icon="schedule">
      <p className="-mt-sm text-body-sm text-on-surface-variant">{t("busy.hint")}</p>
      <Heatmap
        days={days}
        hours={hours}
        cells={cells}
        cellLabel={(d, h, n) => t("busy.cell", { day: days[d], hour: h, count: n })}
        fewer={t("busy.fewer")}
        more={t("busy.more")}
        label={t("busy.title")}
      />
    </Card>
  );
}

function Channels({
  s,
  t,
  money,
  count,
  pct,
}: {
  s: Stats;
  t: T;
  money: (n: number) => string;
  count: Intl.NumberFormat;
  pct: Intl.NumberFormat;
}) {
  const { table, takeaway } = s.channels;
  const total = table.orders + takeaway.orders;
  const part = (name: string, c: { orders: number; revenue: number }) => ({
    name,
    value: c.orders,
    share: pct.format(total ? c.orders / total : 0),
    detail: `${t("orderCount", { count: c.orders })} · ${money(c.revenue)}`,
  });
  return (
    <Card title={t("channels.title")} icon="table_restaurant">
      <SplitBar
        label={t("channels.title")}
        parts={[part(t("channels.table"), table), part(t("channels.takeaway"), takeaway)]}
      />
      <div className="flex flex-col gap-sm border-t border-surface-container-high pt-md">
        <h4 className="text-body-sm font-semibold text-on-surface-variant">
          {t("channels.topTables")}
        </h4>
        {s.topTables.length ? (
          <RankBars
            rows={s.topTables.map((r) => ({
              key: r.label ?? "",
              name: t("channels.tableName", { label: r.label ?? "" }),
              value: r.orders,
              valueLabel: `${count.format(r.orders)} · ${money(r.revenue)}`,
            }))}
          />
        ) : (
          <p className="text-body-sm text-on-surface-variant">{t("channels.noTables")}</p>
        )}
      </div>
    </Card>
  );
}

function Qr({
  s,
  t,
  count,
  pct,
}: {
  s: Stats;
  t: T;
  count: Intl.NumberFormat;
  pct: Intl.NumberFormat;
}) {
  // Several orders can follow one scan: capped at 100 %.
  const rate = s.qrScans ? Math.min(s.totals.orders / s.qrScans, 1) : null;
  return (
    <Card title={t("qr.title")} icon="qr_code_2">
      {s.qrScans ? (
        <dl className="flex flex-col gap-md">
          <div>
            <dt className="text-caption text-on-surface-variant">{t("qr.scans")}</dt>
            <dd className="text-headline-md font-bold text-on-surface">
              {count.format(s.qrScans)}
            </dd>
          </div>
          <div className="flex flex-col gap-xs">
            <dt className="text-caption text-on-surface-variant">{t("qr.conversion")}</dt>
            <dd className="text-headline-md font-bold text-on-surface">{pct.format(rate ?? 0)}</dd>
            <dd className="block h-2 rounded-full bg-surface-container" aria-hidden="true">
              <span
                className="block h-2 rounded-full bg-primary"
                style={{ width: `${(rate ?? 0) * 100}%` }}
              />
            </dd>
          </div>
        </dl>
      ) : (
        <p className="text-body-sm text-on-surface-variant">{t("qr.noScans")}</p>
      )}
    </Card>
  );
}

function Timing({ s, t, count }: { s: Stats; t: T; count: Intl.NumberFormat }) {
  const rows = [
    ["toAccept", s.timing.toAccept],
    ["toReady", s.timing.toReady],
    ["toServe", s.timing.toServe],
  ] as const;
  return (
    <Card title={t("timing.title")} icon="timer">
      <dl className="flex flex-col divide-y divide-surface-container-high">
        {rows.map(([key, v]) => (
          <div key={key} className="flex items-baseline justify-between gap-sm py-sm">
            <dt className="text-body-sm text-on-surface-variant">{t(`timing.${key}`)}</dt>
            <dd className="font-bold text-on-surface">
              {v === null ? t("timing.none") : t("timing.minutes", { n: count.format(v) })}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

/** Placeholder while the statistics load (same frame, no layout jump). */
export function StatsSkeleton() {
  return (
    <div className="flex flex-col gap-md" aria-hidden="true">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-surface-container" />
      <div className="grid grid-cols-2 gap-sm lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-surface-container" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-xl bg-surface-container" />
    </div>
  );
}
