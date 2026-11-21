import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { applyOwnerLocale } from "@/i18n/owner-locale";
import { qrCardText } from "@/lib/qr/card-text";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { KpiTile, StatStrip } from "@/components/stats/charts";
import { PeriodBar } from "@/components/stats/period-bar";
import { PageHeader, TenantShell } from "@/components/tenant/tenant-shell";
import { formatLocale } from "@/config/locale";
import { formatPrice } from "@/lib/menu/schema";
import { tablesSales } from "@/lib/stats/page-schemas";
import { delta, resolvePeriod, todayIn } from "@/lib/stats/period";
import { requireTenantOwner } from "@/lib/auth/guards";
import { tenantDashboard } from "@/lib/auth/routes";
import { cafePalette } from "@/lib/cafes/theme";
import { serverApi } from "@/lib/data/server-api";
import { siteUrl } from "@/lib/env";
import { TablesManager } from "./manager";

export async function generateMetadata(): Promise<Metadata> {
  await applyOwnerLocale();
  return { title: (await getTranslations("tables"))("metaTitle") };
}

async function Tables({
  params,
  searchParams,
}: {
  params: PageProps<"/[tenant]/dashboard/tables">["params"];
  searchParams: PageProps<"/[tenant]/dashboard/tables">["searchParams"];
}) {
  const { tenant } = await params;
  const sp = await searchParams;
  const { area } = sp;
  const { user } = await requireTenantOwner(tenant);
  const locale = await applyOwnerLocale();
  const [t, ts, tp] = await Promise.all([
    getTranslations("tables"),
    getTranslations("stats.tables"),
    getTranslations("stats"),
  ]);
  const api = serverApi();
  const cafe = await api.cafes.mine(tenant);
  if (!cafe) notFound();
  const today = todayIn(cafe.timezone);
  const period = resolvePeriod(sp, today, "30d");
  const [floor, cardText, stats] = await Promise.all([
    api.tables.floor(tenant),
    qrCardText(cafe.locale),
    api.stats.tables(tenant, period.from, period.to),
  ]);
  const base = `${tenantDashboard(cafe.slug).replace(/\/$/, "")}/tables`;
  const fl = formatLocale(locale);
  const count = new Intl.NumberFormat(fl);
  const pct = new Intl.NumberFormat(fl, { style: "percent", maximumFractionDigits: 0 });
  const { totals: cur, previous: prev } = stats;
  // Several orders can follow one scan: capped at 100 %.
  const rate = (s: typeof cur) => (s.scans ? Math.min(s.orders / s.scans, 1) : 0);
  const busiest = [...stats.tables].sort((a, b) => b.orders - a.orders || b.revenue - a.revenue)[0];
  const busiestLabel = busiest?.orders
    ? floor.tables.find((x) => x.id === busiest.tableId)?.label
    : undefined;
  const p = cafePalette(cafe.seed);

  return (
    <TenantShell cafe={cafe} email={user.email} active="tables">
      <PageHeader title={t("title")} description={t("description")} />
      <section aria-label={ts("label")} className="mb-lg flex flex-col gap-sm">
        <PeriodBar
          period={period}
          today={today}
          base={base}
          locale={locale}
          fallback="30d"
          keep={typeof area === "string" ? { area } : {}}
        />
        <StatStrip>
          <KpiTile
            label={ts("scans")}
            value={count.format(cur.scans)}
            change={delta(cur.scans, prev.scans)}
            noPrevious={tp("noPrevious")}
          />
          <KpiTile
            label={ts("tableOrders")}
            value={count.format(cur.tableOrders)}
            change={delta(cur.tableOrders, prev.tableOrders)}
            sub={formatPrice(cur.revenue, cafe.currency)}
            noPrevious={tp("noPrevious")}
          />
          <KpiTile
            label={ts("conversion")}
            value={cur.scans ? pct.format(rate(cur)) : ts("none")}
            change={cur.scans && prev.scans ? delta(rate(cur), rate(prev)) : null}
            noPrevious={tp("noPrevious")}
          />
          <KpiTile
            label={ts("busiest")}
            value={busiestLabel ? ts("busiestValue", { label: busiestLabel }) : ts("none")}
            sub={busiest?.orders ? ts("orders", { count: busiest.orders }) : undefined}
          />
        </StatStrip>
      </section>
      <TablesManager
        slug={cafe.slug}
        cafeName={cafe.name}
        floor={floor}
        cardText={cardText}
        qrBase={siteUrl("/q/")}
        colors={{
          primary: p.primary,
          onPrimary: p.onPrimary,
          container: p.container,
          onContainer: p.onContainer,
        }}
        initialArea={typeof area === "string" ? area : null}
        printHref={`${base}/print`}
        stats={{ sales: tablesSales(stats), currency: cafe.currency }}
      />
    </TenantShell>
  );
}

export default function TablesPage({
  params,
  searchParams,
}: PageProps<"/[tenant]/dashboard/tables">) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <Tables params={params} searchParams={searchParams} />
    </Suspense>
  );
}
