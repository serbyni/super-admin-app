import { getTranslations } from "next-intl/server";
import { Suspense, type ReactNode } from "react";
import { serverApi } from "@/lib/data/server-api";
import { AppShell, type ShellNavItem } from "@/components/shell/app-shell";
import { BrandMark } from "@/components/ui/brand-mark";
import { tenantDashboard } from "@/lib/auth/routes";
import { CafePageLink } from "@/components/cafe/cafe-page-link";
import { cafeHost } from "@/lib/cafes/slug";
import { cafePalette } from "@/lib/cafes/theme";
import type { Cafe } from "@/lib/data/services/cafes";
import { cafeRootDomain } from "@/lib/env";

export { PageHeader } from "@/components/shell/app-shell";

/** Count of orders waiting to be accepted (streams in; hidden when zero or on error). */
async function NewOrdersBadge({ slug }: { slug: string }) {
  const count = await serverApi()
    .orders.board(slug, "active")
    .then((b) => b.orders.filter((o) => o.status === "new").length)
    .catch(() => 0);
  if (!count) return null;
  return (
    <span className="ms-auto rounded-full bg-cta px-xs text-caption font-bold text-on-cta">
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** Café dashboard sections. `soon` = not built yet (shown, not clickable). */
function cafeNav(slug: string, t: (key: NavKey) => string): ShellNavItem[] {
  const base = tenantDashboard(slug).replace(/\/$/, "");
  return [
    { href: base, icon: "dashboard", label: t("dashboard") },
    { href: `${base}/website`, icon: "web", label: t("website") },
    { href: `${base}/menu`, icon: "restaurant_menu", label: t("menu") },
    { href: `${base}/tables`, icon: "table_restaurant", label: t("tables") },
    {
      href: `${base}/orders`,
      icon: "receipt_long",
      label: t("orders"),
      badge: (
        <Suspense fallback={null}>
          <NewOrdersBadge slug={slug} />
        </Suspense>
      ),
    },
    { href: `${base}/staff`, icon: "group", label: t("staff"), soon: true },
    { href: `${base}/settings`, icon: "settings", label: t("settings") },
  ];
}
type NavKey = "dashboard" | "website" | "menu" | "tables" | "orders" | "staff" | "settings";

/**
 * Café owner frame: same layout as the admin area, branded with the café (name, initial,
 * colours generated from its brand colour). `active` = "dashboard" | "menu" | …
 */
export async function TenantShell({
  cafe,
  email,
  active,
  children,
}: {
  cafe: Pick<Cafe, "slug" | "name" | "seed">;
  email: string | undefined;
  active: string;
  children: ReactNode;
}) {
  const [tn, ts, tc] = await Promise.all([
    getTranslations("nav"),
    getTranslations("shell"),
    getTranslations("common"),
  ]);
  const c = cafePalette(cafe.seed);
  const nav = cafeNav(cafe.slug, tn);
  const activeHref = nav.find((n) => n.href.endsWith(`/${active}`))?.href ?? nav[0].href;
  return (
    <AppShell
      homeHref={nav[0].href}
      nav={nav}
      active={activeHref}
      accent={{ background: c.primary, color: c.onPrimary }}
      labels={{ signOut: ts("signOut"), menu: ts("menu"), soon: tc("soon") }}
      brand={
        <>
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-body-md font-bold"
            style={{ backgroundColor: c.primary, color: c.onPrimary }}
          >
            {cafe.name.trim().charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-body-md font-bold text-on-surface">
              {cafe.name}
            </span>
            <span className="block truncate text-caption text-on-surface-variant">
              {cafeHost(cafe.slug, cafeRootDomain())}
            </span>
          </span>
        </>
      }
      footer={
        <div className="flex flex-col gap-xs border-t border-surface-container-high px-sm pt-sm">
          <CafePageLink slug={cafe.slug} variant="inline" className="text-body-sm">
            {ts("viewCafePage")}
          </CafePageLink>
          {email ? (
            <span className="truncate text-caption text-on-surface-variant">{email}</span>
          ) : null}
          <span className="flex items-center gap-xs text-caption text-outline">
            <BrandMark className="h-4 w-4" /> {ts("poweredBy")}
          </span>
        </div>
      }
    >
      {children}
    </AppShell>
  );
}
