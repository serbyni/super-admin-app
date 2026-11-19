import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CafePageLink } from "@/components/cafe/cafe-page-link";
import { PageHeader, TenantShell } from "@/components/tenant/tenant-shell";
import { requireTenantOwner } from "@/lib/auth/guards";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { cafePalette } from "@/lib/cafes/theme";
import { serverApi } from "@/lib/data/server-api";
import { defaultWebsite } from "@/lib/website/schema";
import { WebsiteEditor } from "./editor";

export const metadata: Metadata = { title: "Website" };

async function Website({ params }: { params: PageProps<"/[tenant]/dashboard/website">["params"] }) {
  const { tenant } = await params;
  const { user } = await requireTenantOwner(tenant);
  const api = serverApi();
  const cafe = await api.cafes.mine(tenant);
  if (!cafe) notFound();
  const site = await api.website.get(tenant);

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
        initial={site.draft ?? site.published ?? defaultWebsite(cafe)}
        published={site.published}
        publishedAt={site.publishedAt}
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
