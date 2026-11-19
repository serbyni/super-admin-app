import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { signOut } from "@/app/auth/actions";
import { BrandMark } from "@/components/ui/brand-mark";
import { Icon } from "@/components/ui/icon";
import { CAFE_LOCALES } from "@/config/cafe-defaults";
import { requireTenantOwner } from "@/lib/auth/guards";
import { cafeHost } from "@/lib/cafes/slug";
import { cafePalette } from "@/lib/cafes/theme";
import { serverApi } from "@/lib/data/server-api";
import { cafeRootDomain } from "@/lib/env";

export const metadata: Metadata = { title: "Café dashboard" };

const NEXT_UP = [
  {
    icon: "restaurant_menu",
    title: "Menu",
    body: "Categories, items, prices, photos and options.",
  },
  {
    icon: "table_restaurant",
    title: "Tables & QR codes",
    body: "Create tables and print their QR codes.",
  },
  { icon: "receipt_long", title: "Orders", body: "Receive and manage orders in real time." },
  { icon: "group", title: "Staff", body: "Invite your team." },
];

const COUNTRY = new Intl.DisplayNames(["en"], { type: "region" });

async function Dashboard({ params }: { params: PageProps<"/[tenant]/dashboard">["params"] }) {
  const { tenant } = await params;
  // Page-level check too: layouts are not re-run on every client navigation.
  const { user } = await requireTenantOwner(tenant);
  const cafe = await serverApi().cafes.mine(tenant);
  if (!cafe) notFound();
  // The café's own colours (generated from its brand colour) — the rest of the UI stays Serbi's.
  const c = cafePalette(cafe.seed);
  const host = cafeHost(cafe.slug, cafeRootDomain());

  return (
    <div className="min-h-screen bg-background">
      <header style={{ backgroundColor: c.primary, color: c.onPrimary }}>
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-md px-gutter py-md lg:px-container-margin-desktop">
          <div className="flex min-w-0 items-center gap-sm">
            <span
              aria-hidden="true"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-headline-md font-bold"
              style={{ backgroundColor: c.container, color: c.onContainer }}
            >
              {cafe.name.trim().charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-headline-md font-bold">{cafe.name}</p>
              <p className="truncate text-caption opacity-80">{host}</p>
            </div>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="inline-flex items-center gap-xs rounded-lg px-sm py-xs text-body-sm font-semibold opacity-90 hover:opacity-100"
            >
              <Icon name="logout" className="text-icon-md" flipRtl />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto flex max-w-5xl flex-col gap-lg px-gutter py-lg lg:px-container-margin-desktop">
        <div className="flex flex-col gap-xs sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-display-lg text-primary">Dashboard</h1>
            <p className="mt-xs text-on-surface-variant">Signed in as {user.email}</p>
          </div>
          {cafe.status === "suspended" ? (
            <p className="w-fit rounded-full bg-error-container px-md py-xs text-body-sm font-semibold text-on-error-container">
              Suspended — contact Serbi support
            </p>
          ) : null}
        </div>

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

        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          {NEXT_UP.map((n) => (
            <div key={n.title} className="rounded-xl bg-surface-container-lowest p-lg shadow-sm">
              <span
                className="mb-sm flex h-11 w-11 items-center justify-center rounded-lg"
                style={{ backgroundColor: c.container, color: c.onContainer }}
              >
                <Icon name={n.icon} className="text-icon-xl" />
              </span>
              <p className="text-headline-md text-on-surface">{n.title}</p>
              <p className="mt-xs text-body-sm text-on-surface-variant">{n.body}</p>
              <p className="mt-sm text-caption font-semibold text-outline uppercase">Coming soon</p>
            </div>
          ))}
        </div>

        <p className="flex items-center justify-center gap-xs text-caption text-outline">
          <BrandMark className="h-5 w-5" /> Powered by Serbi
        </p>
      </main>
    </div>
  );
}

export default function TenantDashboardPage({ params }: PageProps<"/[tenant]/dashboard">) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <Dashboard params={params} />
    </Suspense>
  );
}
