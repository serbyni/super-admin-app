import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CafePageLink } from "@/components/cafe/cafe-page-link";
import { PageHeader, TenantShell } from "@/components/tenant/tenant-shell";
import { requireTenantOwner } from "@/lib/auth/guards";
import { serverApi } from "@/lib/data/server-api";
import { MenuManager } from "./manager";

export const metadata: Metadata = { title: "Menu" };

async function MenuPage({ params }: { params: PageProps<"/[tenant]/dashboard/menu">["params"] }) {
  const { tenant } = await params;
  const { user } = await requireTenantOwner(tenant);
  const api = serverApi();
  const cafe = await api.cafes.mine(tenant);
  if (!cafe) notFound();
  const menu = await api.menu.get(tenant);
  const items = menu.items.length;

  return (
    <TenantShell cafe={cafe} email={user.email} active="menu">
      <PageHeader
        title="Menu"
        description={
          items
            ? `${menu.categories.length} categories · ${items} items. Changes show to customers within a minute.`
            : "Your categories and items, with prices and photos."
        }
        actions={<CafePageLink slug={cafe.slug} />}
      />
      <MenuManager slug={cafe.slug} cafeId={cafe.id} currency={cafe.currency} menu={menu} />
    </TenantShell>
  );
}

export default function Page({ params }: PageProps<"/[tenant]/dashboard/menu">) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <MenuPage params={params} />
    </Suspense>
  );
}
