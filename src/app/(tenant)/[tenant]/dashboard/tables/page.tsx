import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader, TenantShell } from "@/components/tenant/tenant-shell";
import { requireTenantOwner } from "@/lib/auth/guards";
import { tenantDashboard } from "@/lib/auth/routes";
import { cafePalette } from "@/lib/cafes/theme";
import { serverApi } from "@/lib/data/server-api";
import { siteUrl } from "@/lib/env";
import { TablesManager } from "./manager";

export const metadata: Metadata = { title: "Tables & QR" };

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
  const api = serverApi();
  const cafe = await api.cafes.mine(tenant);
  if (!cafe) notFound();
  const floor = await api.tables.floor(tenant);
  const p = cafePalette(cafe.seed);

  return (
    <TenantShell cafe={cafe} email={user.email} active="tables">
      <PageHeader
        title="Tables & QR"
        description="Your areas and tables, and the QR codes customers scan to open your menu."
      />
      <TablesManager
        slug={cafe.slug}
        cafeName={cafe.name}
        floor={floor}
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
