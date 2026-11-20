import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader, TenantShell } from "@/components/tenant/tenant-shell";
import { Icon } from "@/components/ui/icon";
import { applyOwnerLocale } from "@/i18n/owner-locale";
import { requireTenantOwner } from "@/lib/auth/guards";
import { tenantDashboard } from "@/lib/auth/routes";
import { serverApi } from "@/lib/data/server-api";
import { formatPrice } from "@/lib/menu/schema";
import { dayTotals, type Order } from "@/lib/orders/schema";
import { OrdersBoard } from "./board";

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
  const { user } = await requireTenantOwner(tenant);
  const locale = await applyOwnerLocale();
  const t = await getTranslations("orders");
  const api = serverApi();
  const cafe = await api.cafes.mine(tenant);
  if (!cafe) notFound();
  const history = view === "history";
  const board = history
    ? await api.orders.board(
        tenant,
        "day",
        typeof day === "string" && DAY.test(day) ? day : undefined,
      )
    : await api.orders.board(tenant, "active");
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
        />
      ) : (
        <OrdersBoard slug={cafe.slug} cafeId={cafe.id} currency={cafe.currency} board={board} />
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
}: {
  orders: Order[];
  day: string;
  currency: string;
  timezone: string;
  locale: string;
  action: string;
}) {
  const t = await getTranslations("orders");
  const totals = dayTotals(orders);
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
      <dl className="grid grid-cols-3 gap-sm">
        {(
          [
            [t("statsOrders"), String(totals.count)],
            [t("statsRevenue"), formatPrice(totals.revenue, currency)],
            [t("statsUnpaid"), String(totals.unpaid)],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-xl bg-surface-container-lowest p-md shadow-sm">
            <dt className="text-caption text-on-surface-variant">{label}</dt>
            <dd className="text-headline-md font-bold text-on-surface tabular-nums" dir="ltr">
              {value}
            </dd>
          </div>
        ))}
      </dl>
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
