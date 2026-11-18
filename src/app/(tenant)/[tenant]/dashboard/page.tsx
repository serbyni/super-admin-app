import type { Metadata } from "next";
import { Suspense } from "react";
import { signOut } from "@/app/auth/actions";
import { BrandMark } from "@/components/ui/brand-mark";
import { Icon } from "@/components/ui/icon";
import { requireTenantOwner } from "@/lib/auth/guards";

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

async function Dashboard({ params }: { params: PageProps<"/[tenant]/dashboard">["params"] }) {
  const { tenant } = await params;
  // Page-level check too: layouts are not re-run on every client navigation.
  const { user } = await requireTenantOwner(tenant);
  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between gap-md bg-surface-container-lowest px-gutter py-sm shadow-header lg:px-container-margin-desktop">
        <div className="flex items-center gap-sm">
          <BrandMark className="h-9 w-9" priority />
          <div>
            <p className="text-body-md font-semibold text-primary">Serbi</p>
            <p className="text-caption text-on-surface-variant">{tenant}.serbi.me</p>
          </div>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="inline-flex items-center gap-xs rounded-lg px-sm py-xs text-body-sm font-semibold text-error hover:bg-error-container"
          >
            <Icon name="logout" className="text-icon-md" flipRtl />
            Sign out
          </button>
        </form>
      </header>
      <main className="mx-auto flex max-w-5xl flex-col gap-lg px-gutter py-lg lg:px-container-margin-desktop">
        <div>
          <h1 className="text-display-lg text-primary">Café dashboard</h1>
          <p className="mt-xs text-on-surface-variant">Signed in as {user.email}</p>
        </div>
        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          {NEXT_UP.map((c) => (
            <div key={c.title} className="rounded-xl bg-surface-container-lowest p-lg shadow-sm">
              <span className="mb-sm flex h-11 w-11 items-center justify-center rounded-lg bg-secondary-container text-primary">
                <Icon name={c.icon} className="text-icon-xl" />
              </span>
              <p className="text-headline-md text-on-surface">{c.title}</p>
              <p className="mt-xs text-body-sm text-on-surface-variant">{c.body}</p>
              <p className="mt-sm text-caption font-semibold text-outline uppercase">Coming soon</p>
            </div>
          ))}
        </div>
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
