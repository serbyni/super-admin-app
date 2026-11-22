import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { applyOwnerLocale } from "@/i18n/owner-locale";
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
import { HoursTab } from "./hours-tab";
import { LanguagesTab } from "./languages-tab";
import { formatDateTime } from "@/config/locale";
import { CafeSettingsForm } from "./forms";

export async function generateMetadata(): Promise<Metadata> {
  await applyOwnerLocale();
  return { title: (await getTranslations("settings"))("metaTitle") };
}

const TABS = [
  { key: "cafe", label: "tabCafe", icon: "storefront" },
  { key: "hours", label: "tabHours", icon: "schedule" },
  { key: "languages", label: "tabLanguages", icon: "translate" },
  { key: "profile", label: "tabProfile", icon: "person" },
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
  const locale = await applyOwnerLocale();
  const t = await getTranslations("settings");
  const { tab: rawTab, email: emailResult } = await searchParams;
  const tab = TABS.find((t) => t.key === rawTab) ?? TABS[0];
  const api = serverApi();
  const cafe = await api.cafes.mine(tenant);
  if (!cafe) notFound();
  const host = cafeHost(cafe.slug, cafeRootDomain());
  const base = tenantSettings(tenant);

  return (
    <TenantShell cafe={cafe} email={user.email} active="settings">
      <PageHeader title={t("title")} description={t("description")} />
      <nav
        aria-label={t("title")}
        className="mb-lg flex gap-xs border-b border-surface-container-high"
      >
        {TABS.map((tab_) => {
          const active = tab_.key === tab.key;
          return (
            <Link
              key={tab_.key}
              href={tab_.key === "cafe" ? base : `${base}?tab=${tab_.key}`}
              aria-current={active ? "page" : undefined}
              className={`-mb-px inline-flex items-center gap-xs border-b-2 px-md py-sm text-body-sm font-semibold transition-colors ${
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <Icon name={tab_.icon} className="text-icon-md" />
              {t(tab_.label)}
            </Link>
          );
        })}
      </nav>

      {tab.key === "cafe" ? (
        <div className="flex flex-col gap-lg">
          <Section title={t("addressTitle")} icon="language" description={t("addressBody")}>
            <p className="flex items-center gap-xs text-body-md">
              <Icon name="link" className="text-icon-lg text-primary" />
              <CafePageLink slug={cafe.slug} variant="inline">
                {host}
              </CafePageLink>
            </p>
            <p className="mt-xs text-caption text-on-surface-variant">{t("addressFixed")}</p>
          </Section>
          <CafeSettingsForm
            action={saveCafeAction.bind(null, tenant)}
            options={cafeFieldOptions(locale)}
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
      ) : tab.key === "hours" ? (
        <HoursTab slug={tenant} hours={cafe.openingHours} />
      ) : tab.key === "languages" ? (
        <LanguagesTabLoader slug={tenant} locale={locale} />
      ) : (
        <ProfileTab
          emailResult={emailResult}
          pendingEmail={user.new_email ?? null}
          uiLocale={locale}
        />
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

async function LanguagesTabLoader({ slug, locale }: { slug: string; locale: string }) {
  const languages = await serverApi().languages.mine(slug);
  // Dates formatted on the server (same text in the browser — no hydration mismatch).
  const dates = Object.fromEntries(
    languages.requests.map((r) => [r.id, formatDateTime(r.createdAt, locale)]),
  );
  return <LanguagesTab slug={slug} languages={languages} dates={dates} />;
}
