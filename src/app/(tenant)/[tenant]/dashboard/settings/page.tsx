import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader, TenantShell } from "@/components/tenant/tenant-shell";
import { Icon } from "@/components/ui/icon";
import { cafeFieldOptions } from "@/config/cafe-options";
import { requireTenantOwner } from "@/lib/auth/guards";
import { tenantSettings } from "@/lib/auth/routes";
import { socialHandle } from "@/lib/cafes/contact";
import { cafeHost } from "@/lib/cafes/slug";
import { serverApi } from "@/lib/data/server-api";
import { cafeRootDomain } from "@/lib/env";
import { CafePageLink } from "@/components/cafe/cafe-page-link";
import { ProfileTab } from "@/components/settings/profile-tab";
import { Section } from "@/components/settings/form-kit";
import { saveCafeAction } from "./actions";
import { CafeSettingsForm } from "./forms";

export const metadata: Metadata = { title: "Settings" };

const TABS = [
  { key: "cafe", label: "Café", icon: "storefront" },
  { key: "profile", label: "Profile", icon: "person" },
] as const;

async function Settings({
  params,
  searchParams,
}: {
  params: PageProps<"/[tenant]/dashboard/settings">["params"];
  searchParams: PageProps<"/[tenant]/dashboard/settings">["searchParams"];
}) {
  const { tenant } = await params;
  const { user } = await requireTenantOwner(tenant);
  const { tab: rawTab, email: emailResult } = await searchParams;
  const tab = TABS.find((t) => t.key === rawTab) ?? TABS[0];
  const api = serverApi();
  const cafe = await api.cafes.mine(tenant);
  if (!cafe) notFound();
  const host = cafeHost(cafe.slug, cafeRootDomain());
  const base = tenantSettings(tenant);

  return (
    <TenantShell cafe={cafe} email={user.email} active="settings">
      <PageHeader title="Settings" description="Your café and your account." />
      <nav
        aria-label="Settings"
        className="mb-lg flex gap-xs border-b border-surface-container-high"
      >
        {TABS.map((t) => {
          const active = t.key === tab.key;
          return (
            <Link
              key={t.key}
              href={t.key === "cafe" ? base : `${base}?tab=${t.key}`}
              aria-current={active ? "page" : undefined}
              className={`-mb-px inline-flex items-center gap-xs border-b-2 px-md py-sm text-body-sm font-semibold transition-colors ${
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <Icon name={t.icon} className="text-icon-md" />
              {t.label}
            </Link>
          );
        })}
      </nav>

      {tab.key === "cafe" ? (
        <div className="flex flex-col gap-lg">
          <Section
            title="Café address"
            icon="language"
            description="Customers open your menu at this address. Your printed QR codes keep working even if it changes later."
          >
            <p className="flex items-center gap-xs text-body-md">
              <Icon name="link" className="text-icon-lg text-primary" />
              <CafePageLink slug={cafe.slug} variant="inline">
                {host}
              </CafePageLink>
            </p>
            <p className="mt-xs text-caption text-on-surface-variant">
              Changing the café address is not available yet — contact us if you need it.
            </p>
          </Section>
          <CafeSettingsForm
            action={saveCafeAction.bind(null, tenant)}
            options={cafeFieldOptions()}
            host={host}
            values={{
              name: cafe.name,
              country_code: cafe.countryCode,
              city: cafe.city ?? undefined,
              address: cafe.address ?? undefined,
              currency: cafe.currency,
              timezone: cafe.timezone,
              locale: cafe.locale,
              phone: cafe.phone ?? undefined,
              email: cafe.contactEmail ?? undefined,
              facebook: cafe.facebook ? socialHandle(cafe.facebook) : undefined,
              instagram: cafe.instagram ? socialHandle(cafe.instagram) : undefined,
              seed: cafe.seed,
            }}
          />
        </div>
      ) : (
        <ProfileTab emailResult={emailResult} pendingEmail={user.new_email ?? null} />
      )}
    </TenantShell>
  );
}

export default function SettingsPage({
  params,
  searchParams,
}: PageProps<"/[tenant]/dashboard/settings">) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <Settings params={params} searchParams={searchParams} />
    </Suspense>
  );
}
