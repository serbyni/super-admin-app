import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { applyOwnerLocale } from "@/i18n/owner-locale";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CafePageLink } from "@/components/cafe/cafe-page-link";
import { KpiTile, StatStrip } from "@/components/stats/charts";
import { PeriodBar } from "@/components/stats/period-bar";
import { PageHeader, TenantShell } from "@/components/tenant/tenant-shell";
import { requireTenantOwner } from "@/lib/auth/guards";
import { formatLocale } from "@/config/locale";
import { tenantDashboard } from "@/lib/auth/routes";
import { serverApi } from "@/lib/data/server-api";
import { formatPrice } from "@/lib/menu/schema";
import { menuSales, noSaleItems } from "@/lib/stats/page-schemas";
import { delta, resolvePeriod, todayIn } from "@/lib/stats/period";
import { MenuManager } from "./manager";

export async function generateMetadata(): Promise<Metadata> {
  await applyOwnerLocale();
  return { title: (await getTranslations("menu"))("metaTitle") };
}

async function MenuPage({
  params,
  searchParams,
}: {
  params: PageProps<"/[tenant]/dashboard/menu">["params"];
  searchParams: PageProps<"/[tenant]/dashboard/menu">["searchParams"];
}) {
  const { tenant } = await params;
  const { user } = await requireTenantOwner(tenant);
  const locale = await applyOwnerLocale();
  const [t, ts, tp] = await Promise.all([
    getTranslations("menu"),
    getTranslations("stats.menu"),
    getTranslations("stats"),
  ]);
  const api = serverApi();
  const cafe = await api.cafes.mine(tenant);
  if (!cafe) notFound();
  const today = todayIn(cafe.timezone);
  const period = resolvePeriod(await searchParams, today, "30d");
  const [menu, langs, stats] = await Promise.all([
    api.menu.get(tenant),
    api.languages.mine(tenant),
    api.stats.menu(tenant, period.from, period.to),
  ]);
  const items = menu.items.length;
  const base = `${tenantDashboard(cafe.slug).replace(/\/$/, "")}/menu`;
  const fl = formatLocale(locale);
  const count = new Intl.NumberFormat(fl);
  const pct = new Intl.NumberFormat(fl, { style: "percent", maximumFractionDigits: 0 });
  const visibleCats = new Set(menu.categories.filter((c) => c.isVisible).map((c) => c.id));
  const noSale = noSaleItems(menu.items, visibleCats, stats);
  const best = [...stats.categories].sort((a, b) => b.revenue - a.revenue)[0];
  const bestName = best && menu.categories.find((c) => c.id === best.categoryId)?.name;

  return (
    <TenantShell cafe={cafe} email={user.email} active="menu">
      <PageHeader
        title={t("title")}
        description={
          items
            ? t("summary", { categories: menu.categories.length, items })
            : t("emptyDescription")
        }
        actions={<CafePageLink slug={cafe.slug} />}
      />
      {items ? (
        <section aria-label={ts("label")} className="mb-lg flex flex-col gap-sm">
          <PeriodBar period={period} today={today} base={base} locale={locale} fallback="30d" />
          <StatStrip>
            <KpiTile
              label={ts("itemsSold")}
              value={count.format(stats.totals.sold)}
              change={delta(stats.totals.sold, stats.previous.sold)}
              noPrevious={tp("noPrevious")}
            />
            <KpiTile
              label={ts("revenue")}
              value={formatPrice(stats.totals.revenue, cafe.currency)}
              change={delta(stats.totals.revenue, stats.previous.revenue)}
              noPrevious={tp("noPrevious")}
            />
            <KpiTile
              label={ts("bestCategory")}
              value={bestName ?? "—"}
              sub={
                best && stats.totals.revenue
                  ? ts("bestCategoryValue", {
                      share: pct.format(best.revenue / stats.totals.revenue),
                    })
                  : undefined
              }
            />
            <KpiTile
              label={ts("noSaleCount")}
              value={count.format(noSale.length)}
              alert={noSale.length > 0}
              sub={ts("noSaleHint")}
            />
          </StatStrip>
        </section>
      ) : null}
      <MenuManager
        slug={cafe.slug}
        cafeId={cafe.id}
        currency={cafe.currency}
        menu={menu}
        languages={{ main: langs.main, others: langs.offered.filter((l) => l !== langs.main) }}
        sales={menuSales(stats)}
      />
    </TenantShell>
  );
}

export default function Page({ params, searchParams }: PageProps<"/[tenant]/dashboard/menu">) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <MenuPage params={params} searchParams={searchParams} />
    </Suspense>
  );
}
