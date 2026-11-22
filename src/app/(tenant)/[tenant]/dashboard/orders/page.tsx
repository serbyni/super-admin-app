import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ColumnChart, KpiTile, StatStrip, type Column } from "@/components/stats/charts";
import { PageHeader, TenantShell } from "@/components/tenant/tenant-shell";
import { formatLocale } from "@/config/locale";
import { addDays, delta } from "@/lib/stats/period";
import { averageTicket } from "@/lib/stats/schema";
import { Icon } from "@/components/ui/icon";
import { applyOwnerLocale } from "@/i18n/owner-locale";
import { can } from "@/lib/access/ability";
import { requireTenantAccess } from "@/lib/access/server";
import { tenantDashboard, tenantSettings } from "@/lib/auth/routes";
import { serverApi } from "@/lib/data/server-api";
import { formatPrice } from "@/lib/menu/schema";
import type { Order } from "@/lib/orders/schema";
import { OrdersBoard } from "./board";
import { PushCard } from "./push-card";

export async function generateMetadata(): Promise<Metadata> {
  await applyOwnerLocale();
  return { title: (await getTranslations("orders"))("metaTitle") };
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

async function OrdersPage({
  params,
  searchParams,
}: {
  params: PageProps<"/[tenant]/dashboard/orders">["params"];
  searchParams: PageProps<"/[tenant]/dashboard/orders">["searchParams"];
}) {
  const { tenant } = await params;
  const { view, day } = await searchParams;
  const { user, ability } = await requireTenantAccess(tenant, "orders.read");
  const locale = await applyOwnerLocale();
  const t = await getTranslations("orders");
  const api = serverApi();
  const cafe = await api.cafes.mine(tenant);
  if (!cafe) notFound();
  const history = view === "history";
  const [board, today] = history
    ? [
        await api.orders.board(
          tenant,
          "day",
          typeof day === "string" && DAY.test(day) ? day : undefined,
        ),
        null,
      ]
    : await Promise.all([api.orders.board(tenant, "active"), api.orders.board(tenant, "day")]);
  // Tables to move an order to: only for members who handle orders.
  const floor = history || !can(ability, "orders.handle") ? null : await api.tables.floor(tenant);
  const areaName = new Map(floor?.areas.map((a) => [a.id, a.name]));
  const tables = (floor?.tables ?? [])
    .filter((x) => x.isActive)
    .map((x) => ({ id: x.id, label: x.label, area: areaName.get(x.areaId) ?? "" }));
  const base = `${tenantDashboard(cafe.slug).replace(/\/$/, "")}/orders`;

  return (
    <TenantShell cafe={cafe} email={user.email} active="orders">
      <PageHeader title={t("title")} description={t("description")} />
      <nav
        aria-label={t("title")}
        className="mb-lg flex gap-xs border-b border-surface-container-high"
      >
        {(
          [
            ["board", base, "bolt", t("tabBoard")],
            ["history", `${base}?view=history`, "history", t("tabHistory")],
          ] as const
        ).map(([key, href, icon, label]) => {
          const active = (key === "history") === history;
          return (
            <Link
              key={key}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`-mb-px inline-flex items-center gap-xs border-b-2 px-md py-sm text-body-sm font-semibold ${
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <Icon name={icon} className="text-icon-md" />
              {label}
            </Link>
          );
        })}
      </nav>
      {history ? (
        <History
          orders={board.orders}
          day={typeof day === "string" && DAY.test(day) ? day : board.today}
          currency={cafe.currency}
          timezone={cafe.timezone}
          locale={locale}
          action={base}
          slug={cafe.slug}
        />
      ) : (
        <div className="flex flex-col gap-lg">
          {process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ? (
            <PushCard slug={cafe.slug} vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY} />
          ) : null}
          {cafe.menuMode === "menu_only" ? (
            <section className="flex items-start gap-md rounded-xl bg-secondary-container p-md text-on-secondary-container">
              <Icon name="menu_book" className="text-icon-xl" />
              <div className="flex flex-col gap-xs">
                <p className="font-semibold">{t("menuOnlyTitle")}</p>
                <p className="text-body-sm">{t("menuOnlyBody")}</p>
                <Link
                  href={`${tenantSettings(cafe.slug)}?tab=display`}
                  className="w-fit text-body-sm font-semibold underline underline-offset-2"
                >
                  {t("menuOnlyLink")}
                </Link>
              </div>
            </section>
          ) : null}
          <OrdersBoard
            menuOnly={cafe.menuMode === "menu_only"}
            slug={cafe.slug}
            cafeId={cafe.id}
            currency={cafe.currency}
            board={board}
            today={today?.orders ?? []}
            tables={tables}
          />
        </div>
      )}
    </TenantShell>
  );
}

async function History({
  orders,
  day,
  currency,
  timezone,
  locale,
  action,
  slug,
}: {
  orders: Order[];
  day: string;
  currency: string;
  timezone: string;
  locale: string;
  action: string;
  slug: string;
}) {
  const [t, ts, tp] = await Promise.all([
    getTranslations("orders"),
    getTranslations("stats.orders"),
    getTranslations("stats"),
  ]);
  const lastWeek = addDays(day, -7);
  const api = serverApi();
  const [s, w] = await Promise.all([
    api.stats.get(slug, day, day),
    api.stats.get(slug, lastWeek, lastWeek),
  ]);
  const fl = formatLocale(locale);
  const pct = new Intl.NumberFormat(fl, { style: "percent", maximumFractionDigits: 0 });
  const received = (x: typeof s.totals) => x.orders + x.declined + x.cancelled;
  const declinedRate = (x: typeof s.totals) => (received(x) ? x.declined / received(x) : 0);
  const vs = ts("vsLastWeek", {
    day: new Intl.DateTimeFormat(fl, {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(new Date(`${lastWeek}T00:00:00Z`)),
  });
  const columns: Column[] = s.series.map((b, i) => ({
    key: b.at,
    label: b.at,
    showLabel: i % 3 === 0,
    value: b.revenue,
    tip: [`${b.at}:00`, formatPrice(b.revenue, currency), tp("orderCount", { count: b.orders })],
  }));
  const time = new Intl.DateTimeFormat(locale === "ar" ? "ar-TN" : locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  });
  return (
    <div className="flex flex-col gap-md">
      <form action={action} className="flex flex-wrap items-end gap-sm">
        <input type="hidden" name="view" value="history" />
        <label className="flex flex-col gap-xs text-body-sm font-semibold text-on-surface">
          {t("day")}
          <input
            type="date"
            name="day"
            defaultValue={day}
            className="rounded-lg border border-outline-variant bg-transparent px-sm py-xs font-normal"
          />
        </label>
        <button
          type="submit"
          className="rounded-xl border border-outline-variant px-md py-xs text-body-sm font-semibold text-primary hover:bg-secondary-container"
        >
          <Icon name="search" className="text-icon-md" />
        </button>
      </form>
      <div className="flex flex-col gap-xs">
        <StatStrip>
          <KpiTile
            label={t("statsOrders")}
            value={String(s.totals.orders)}
            change={delta(s.totals.orders, w.totals.orders)}
            noPrevious={tp("noPrevious")}
          />
          <KpiTile
            label={t("statsRevenue")}
            value={formatPrice(s.totals.revenue, currency)}
            change={delta(s.totals.revenue, w.totals.revenue)}
            sub={`${t("statsUnpaid")}: ${s.totals.unpaid}`}
            noPrevious={tp("noPrevious")}
          />
          <KpiTile
            label={ts("avgTicket")}
            value={formatPrice(averageTicket(s.totals), currency)}
            change={delta(averageTicket(s.totals), averageTicket(w.totals))}
            noPrevious={tp("noPrevious")}
          />
          <KpiTile
            label={ts("declinedRate")}
            value={pct.format(declinedRate(s.totals))}
            change={delta(declinedRate(s.totals), declinedRate(w.totals))}
            upIsGood={false}
            noPrevious={tp("noPrevious")}
          />
        </StatStrip>
        <p className="text-caption text-on-surface-variant">{vs}</p>
      </div>
      {s.totals.orders ? (
        <section className="flex flex-col gap-sm rounded-xl bg-surface-container-lowest p-lg pt-xl shadow-sm">
          <h2 className="text-body-lg font-semibold text-on-surface">{ts("byHour")}</h2>
          <ColumnChart
            columns={columns}
            maxLabel={formatPrice(Math.max(...s.series.map((b) => b.revenue)), currency)}
            label={ts("byHour")}
          />
        </section>
      ) : null}
      {orders.length === 0 ? (
        <p className="rounded-xl bg-surface-container-lowest p-lg text-center text-on-surface-variant">
          {t("noHistory")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-surface-container-lowest shadow-sm">
          <table className="w-full text-start text-body-sm">
            <thead className="text-caption text-on-surface-variant">
              <tr>
                {[
                  t("colNumber"),
                  t("colTime"),
                  t("colWhere"),
                  t("colItems"),
                  t("colStatus"),
                  t("colTotal"),
                ].map((h) => (
                  <th key={h} className="px-md py-sm text-start font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-high">
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="px-md py-sm font-bold">#{o.number}</td>
                  <td className="px-md py-sm tabular-nums">{time.format(new Date(o.createdAt))}</td>
                  <td className="px-md py-sm">
                    {o.kind === "table"
                      ? t("table", { label: o.tableLabel ?? "" })
                      : t("takeaway", { name: o.customerName })}
                  </td>
                  <td className="px-md py-sm" dir="auto">
                    {o.items.map((li) => `${li.quantity} × ${li.name}`).join(", ")}
                  </td>
                  <td className="px-md py-sm">
                    {t(`status.${o.status}`)}
                    {o.status !== "declined" && o.status !== "cancelled"
                      ? ` · ${o.isPaid ? t("paid") : t("unpaid")}`
                      : ""}
                  </td>
                  <td className="px-md py-sm font-semibold tabular-nums" dir="ltr">
                    {formatPrice(o.subtotal, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function Page({ params, searchParams }: PageProps<"/[tenant]/dashboard/orders">) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <OrdersPage params={params} searchParams={searchParams} />
    </Suspense>
  );
}
