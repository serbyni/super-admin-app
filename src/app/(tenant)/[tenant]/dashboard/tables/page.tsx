import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { applyOwnerLocale } from "@/i18n/owner-locale";
import { qrCardText } from "@/lib/qr/card-text";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader, TenantShell } from "@/components/tenant/tenant-shell";
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
  const { area } = await searchParams;
  const { user } = await requireTenantOwner(tenant);
  await applyOwnerLocale();
  const t = await getTranslations("tables");
  const api = serverApi();
  const cafe = await api.cafes.mine(tenant);
  if (!cafe) notFound();
  const [floor, cardText] = await Promise.all([api.tables.floor(tenant), qrCardText(cafe.locale)]);
  const p = cafePalette(cafe.seed);

  return (
    <TenantShell cafe={cafe} email={user.email} active="tables">
      <PageHeader title={t("title")} description={t("description")} />
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
        printHref={`${tenantDashboard(cafe.slug).replace(/\/$/, "")}/tables/print`}
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
