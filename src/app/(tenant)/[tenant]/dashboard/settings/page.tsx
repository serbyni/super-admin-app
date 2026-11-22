import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { applyOwnerLocale } from "@/i18n/owner-locale";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader, TenantShell } from "@/components/tenant/tenant-shell";
import { Icon } from "@/components/ui/icon";
import { cafeFieldOptions } from "@/config/cafe-options";
import { can } from "@/lib/access/ability";
import type { Permission } from "@/lib/access/permissions";
import { requireTenantAccess } from "@/lib/access/server";
import { RolesTab } from "./roles-tab";
import { tenantSettings } from "@/lib/auth/routes";
import { socialHandle } from "@/lib/cafes/contact";
import { cafeHost } from "@/lib/cafes/slug";
import { serverApi } from "@/lib/data/server-api";
import { cafeRootDomain } from "@/lib/env";
import { CafePageLink } from "@/components/cafe/cafe-page-link";
import { ProfileTab } from "@/components/settings/profile-tab";
import { Section } from "@/components/settings/form-kit";
import { saveCafeAction } from "./actions";
import { cafeUrl } from "@/lib/env";
import { HoursTab } from "./hours-tab";
import { MenuDisplayTab } from "./menu-display-tab";
import { LanguagesTab } from "./languages-tab";
import { formatDateTime } from "@/config/locale";
import { CafeSettingsForm } from "./forms";

export async function generateMetadata(): Promise<Metadata> {
  await applyOwnerLocale();
  return { title: (await getTranslations("settings"))("metaTitle") };
}

/** Tabs and the permission each needs (Profile = your own account, always there). */
const TABS = [
  { key: "cafe", label: "tabCafe", icon: "storefront", perm: "settings.cafe" },
  { key: "hours", label: "tabHours", icon: "schedule", perm: "settings.hours" },
  { key: "display", label: "tabDisplay", icon: "auto_stories", perm: "settings.display" },
  { key: "languages", label: "tabLanguages", icon: "translate", perm: "settings.languages" },
  { key: "roles", label: "tabRoles", icon: "badge", perm: "staff.manage" },
  { key: "profile", label: "tabProfile", icon: "person", perm: null },
] as const satisfies readonly {
  key: string;
  label: string;
  icon: string;
  perm: Permission | null;
}[];

async function Settings({
  params,
  searchParams,
}: {
  params: PageProps<"/[tenant]/dashboard/settings">["params"];
  searchParams: PageProps<"/[tenant]/dashboard/settings">["searchParams"];
}) {
  const { tenant } = await params;
  const { user, ability } = await requireTenantAccess(tenant);
  const locale = await applyOwnerLocale();
  const t = await getTranslations("settings");
  const { tab: rawTab, email: emailResult } = await searchParams;
  const tabs = TABS.filter((x) => x.perm === null || can(ability, x.perm));
  const tab = tabs.find((t) => t.key === rawTab) ?? tabs[0];
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
        className="mb-lg flex gap-xs overflow-x-auto border-b border-surface-container-high"
      >
        {tabs.map((tab_) => {
          const active = tab_.key === tab.key;
          return (
            <Link
              key={tab_.key}
              href={tab_.key === tabs[0].key ? base : `${base}?tab=${tab_.key}`}
              aria-current={active ? "page" : undefined}
              className={`-mb-px inline-flex shrink-0 items-center gap-xs border-b-2 px-md py-sm text-body-sm font-semibold whitespace-nowrap transition-colors ${
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
      ) : tab.key === "display" ? (
        <MenuDisplayTab
          slug={tenant}
          mode={cafe.menuMode}
          display={cafe.menuDisplay}
          menuUrl={`${cafeUrl(cafe.slug)}/menu`}
        />
      ) : tab.key === "languages" ? (
        <LanguagesTabLoader slug={tenant} locale={locale} />
      ) : tab.key === "roles" ? (
        <RolesTabLoader slug={tenant} />
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

async function RolesTabLoader({ slug }: { slug: string }) {
  const api = serverApi();
  const [roles, shifts] = await Promise.all([api.access.roles(slug), api.access.shifts(slug)]);
  return <RolesTab slug={slug} roles={roles} shifts={shifts} />;
}
