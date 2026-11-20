import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CafePageLink } from "@/components/cafe/cafe-page-link";
import { PageHeader, TenantShell } from "@/components/tenant/tenant-shell";
import { Icon } from "@/components/ui/icon";
import { CAFE_LOCALES } from "@/config/cafe-defaults";
import { requireTenantOwner } from "@/lib/auth/guards";
import { tenantDashboard } from "@/lib/auth/routes";
import { cafePalette } from "@/lib/cafes/theme";
import { serverApi } from "@/lib/data/server-api";

export const metadata: Metadata = { title: "Café dashboard" };

/** Modules not built yet. */
const SOON = [
  { icon: "receipt_long", title: "Orders", body: "Receive and manage orders in real time." },
  { icon: "group", title: "Staff", body: "Invite your team." },
];

type Stat = { label: string; value: string | number; tone?: "warn" };

const COUNTRY = new Intl.DisplayNames(["en"], { type: "region" });

async function Dashboard({ params }: { params: PageProps<"/[tenant]/dashboard">["params"] }) {
  const { tenant } = await params;
  // Page-level check too: layouts are not re-run on every client navigation.
  const { user } = await requireTenantOwner(tenant);
  const api = serverApi();
  const cafe = await api.cafes.mine(tenant);
  if (!cafe) notFound();
  const c = cafePalette(cafe.seed);
  const [menu, floor, site] = await Promise.all([
    api.menu.get(tenant),
    api.tables.floor(tenant),
    api.website.get(tenant),
  ]);
  const base = tenantDashboard(cafe.slug).replace(/\/$/, "");
  const visibleCats = new Set(menu.categories.filter((x) => x.isVisible).map((x) => x.id));
  const unpriced = menu.items.filter((i) => i.price === null).length;
  const soldOut = menu.items.filter((i) => !i.isAvailable).length;
  const scans = floor.menu.scans30d + floor.tables.reduce((n, t) => n + t.scans30d, 0);
  const websiteState = !site.published
    ? "Not published"
    : JSON.stringify(site.draft) !== JSON.stringify(site.published)
      ? "Unpublished changes"
      : "Published";
  const modules: { href: string; icon: string; title: string; stats: Stat[]; cta: string }[] = [
    {
      href: `${base}/menu`,
      icon: "restaurant_menu",
      title: "Menu",
      cta: menu.items.length ? "Manage menu" : "Create your menu",
      stats: [
        { label: "Items", value: menu.items.length },
        { label: "Sold out", value: soldOut, tone: soldOut ? "warn" : undefined },
        { label: "No price", value: unpriced, tone: unpriced ? "warn" : undefined },
      ],
    },
    {
      href: `${base}/tables`,
      icon: "table_restaurant",
      title: "Tables & QR",
      cta: floor.tables.length ? "Tables & QR codes" : "Add your tables",
      stats: [
        { label: "Tables", value: floor.tables.length },
        { label: "Areas", value: floor.areas.length },
        { label: "Scans · 30 d", value: scans },
      ],
    },
    {
      href: `${base}/website`,
      icon: "web",
      title: "Website",
      cta: "Edit website",
      stats: [
        {
          label: "Status",
          value: websiteState,
          tone: websiteState === "Published" ? undefined : "warn",
        },
        {
          label: "Featured",
          // Same rule as the website: featured items customers can see (visible, priced).
          value: menu.items.filter(
            (i) => i.isFeatured && i.isVisible && i.price !== null && visibleCats.has(i.categoryId),
          ).length,
        },
      ],
    },
  ];

  return (
    <TenantShell cafe={cafe} email={user.email} active="dashboard">
      <PageHeader
        title="Dashboard"
        description={`Welcome back to ${cafe.name}.`}
        actions={
          cafe.status === "suspended" ? (
            <p className="w-fit rounded-full bg-error-container px-md py-xs text-body-sm font-semibold text-on-error-container">
              Suspended — contact Serbi support
            </p>
          ) : (
            <CafePageLink slug={cafe.slug} />
          )
        }
      />
      <div className="flex flex-col gap-lg">
        <section className="rounded-xl bg-surface-container-lowest p-lg shadow-sm">
          <h2 className="mb-sm flex items-center gap-sm text-headline-md text-on-surface">
            <Icon name="storefront" className="text-icon-xl text-primary" />
            Your café
          </h2>
          <dl className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "Location",
                value: [cafe.city, COUNTRY.of(cafe.countryCode)].filter(Boolean).join(", "),
              },
              { label: "Currency", value: cafe.currency },
              { label: "Time zone", value: cafe.timezone.replaceAll("_", " ") },
              {
                label: "Menu language",
                value: CAFE_LOCALES.find((l) => l.value === cafe.locale)?.label ?? cafe.locale,
              },
            ].map((r) => (
              <div key={r.label}>
                <dt className="text-caption text-on-surface-variant">{r.label}</dt>
                <dd className="text-body-sm font-semibold text-on-surface">{r.value || "—"}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="grid grid-cols-1 gap-md md:grid-cols-3">
          {modules.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="group flex flex-col gap-md rounded-xl bg-surface-container-lowest p-lg shadow-sm transition-shadow hover:shadow-card-warm"
            >
              <span className="flex items-center gap-sm">
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-lg"
                  style={{ backgroundColor: c.container, color: c.onContainer }}
                >
                  <Icon name={m.icon} className="text-icon-xl" />
                </span>

                <span className="text-headline-md text-on-surface">{m.title}</span>
              </span>

              <dl className="grid grid-cols-3 gap-sm">
                {m.stats.map((st) => (
                  <div key={st.label} className={st.label === "Status" ? "col-span-2" : ""}>
                    <dt className="text-caption text-on-surface-variant">{st.label}</dt>

                    <dd
                      className={`text-body-md font-bold tabular-nums ${st.tone === "warn" ? "text-on-warning-container" : "text-on-surface"}`}
                    >
                      {st.value}
                    </dd>
                  </div>
                ))}
              </dl>

              <span className="mt-auto inline-flex items-center gap-xs text-body-sm font-semibold text-primary">
                {m.cta}

                <Icon name="arrow_forward" className="text-icon-md" flipRtl />
              </span>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          {SOON.map((n) => (
            <div
              key={n.title}
              className="flex items-center gap-md rounded-xl bg-surface-container-lowest p-md opacity-80 shadow-sm"
            >
              <Icon name={n.icon} className="text-icon-xl text-outline" />

              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-on-surface">{n.title}</span>

                <span className="block text-body-sm text-on-surface-variant">{n.body}</span>
              </span>

              <span className="text-caption font-semibold text-outline uppercase">Soon</span>
            </div>
          ))}
        </div>
      </div>
    </TenantShell>
  );
}

export default function TenantDashboardPage({ params }: PageProps<"/[tenant]/dashboard">) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <Dashboard params={params} />
    </Suspense>
  );
}
