import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { applyOwnerLocale } from "@/i18n/owner-locale";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CafePageLink } from "@/components/cafe/cafe-page-link";
import { PageHeader, TenantShell } from "@/components/tenant/tenant-shell";
import { requireTenantOwner } from "@/lib/auth/guards";
import { serverApi } from "@/lib/data/server-api";
import { MenuManager } from "./manager";

export async function generateMetadata(): Promise<Metadata> {
  await applyOwnerLocale();
  return { title: (await getTranslations("menu"))("metaTitle") };
}

async function MenuPage({ params }: { params: PageProps<"/[tenant]/dashboard/menu">["params"] }) {
  const { tenant } = await params;
  const { user } = await requireTenantOwner(tenant);
  await applyOwnerLocale();
  const t = await getTranslations("menu");
  const api = serverApi();
  const cafe = await api.cafes.mine(tenant);
  if (!cafe) notFound();
  const [menu, langs] = await Promise.all([api.menu.get(tenant), api.languages.mine(tenant)]);
  const items = menu.items.length;

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
      <MenuManager
        slug={cafe.slug}
        cafeId={cafe.id}
        currency={cafe.currency}
        menu={menu}
        languages={{ main: langs.main, others: langs.offered.filter((l) => l !== langs.main) }}
      />
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
