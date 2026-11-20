import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CafePageLink } from "@/components/cafe/cafe-page-link";
import { PageHeader, TenantShell } from "@/components/tenant/tenant-shell";
import { requireTenantOwner } from "@/lib/auth/guards";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { cafePalette } from "@/lib/cafes/theme";
import { serverApi } from "@/lib/data/server-api";
import { tenantDashboard } from "@/lib/auth/routes";
import { formatPrice } from "@/lib/menu/schema";
import { SPECIALTIES_MAX, defaultWebsite, withAllSections } from "@/lib/website/schema";
import { WebsiteEditor } from "./editor";

export const metadata: Metadata = { title: "Website" };

async function Website({ params }: { params: PageProps<"/[tenant]/dashboard/website">["params"] }) {
  const { tenant } = await params;
  const { user } = await requireTenantOwner(tenant);
  const api = serverApi();
  const cafe = await api.cafes.mine(tenant);
  if (!cafe) notFound();
  const [site, menu, langs] = await Promise.all([
    api.website.get(tenant),
    api.menu.get(tenant),
    api.languages.mine(tenant),
  ]);
  const visibleCats = new Set(menu.categories.filter((c) => c.isVisible).map((c) => c.id));
  // Same rule as the café site: featured, visible, priced, in a visible category.
  const featured = menu.items
    .filter((i) => i.isFeatured && i.isVisible && i.price !== null && visibleCats.has(i.categoryId))
    .slice(0, SPECIALTIES_MAX)
    .map((i) => ({
      id: i.id,
      name: i.name,
      price: formatPrice(i.price!, cafe.currency),
      image: i.image,
    }));

  return (
    <TenantShell cafe={cafe} email={user.email} active="website">
      <PageHeader
        title="Website"
        description="Your café's home page. Edit it as a draft, check the preview, then publish."
        actions={<CafePageLink slug={cafe.slug} />}
      />
      <WebsiteEditor
        slug={cafe.slug}
        cafeId={cafe.id}
        cafeName={cafe.name}
        palette={cafePalette(cafe.seed)}
        contact={{
          address: [cafe.address, cafe.city].filter(Boolean).join(", ") || null,
          phone: cafe.phone
            ? (parsePhoneNumberFromString(cafe.phone)?.formatInternational() ?? cafe.phone)
            : null,
        }}
        initial={withAllSections(site.draft ?? site.published ?? defaultWebsite(cafe))}
        published={site.published ? withAllSections(site.published) : null}
        publishedAt={site.publishedAt}
        featured={featured}
        menuHref={`${tenantDashboard(cafe.slug).replace(/\/$/, "")}/menu`}
        languages={{ main: langs.main, others: langs.offered.filter((l) => l !== langs.main) }}
      />
    </TenantShell>
  );
}

export default function WebsitePage({ params }: PageProps<"/[tenant]/dashboard/website">) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <Website params={params} />
    </Suspense>
  );
}
