import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminShell, PageHeader } from "@/components/admin/admin-shell";
import { Icon } from "@/components/ui/icon";
import { requireAdmin } from "@/lib/auth/admin";
import { serverApi } from "@/lib/data/server-api";
import { listBusinessTypesForAdmin } from "./business/data";

export const metadata: Metadata = { title: "Admin" };

async function Welcome() {
  const { user } = await requireAdmin();
  const api = serverApi();
  const [types, owners, cafes] = await Promise.all([
    listBusinessTypesForAdmin(),
    api.users.stats(),
    api.cafes.adminList(),
  ]);
  const suspendedCafes = cafes.filter((c) => c.status === "suspended").length;
  const active = types.filter((t) => t.is_active).length;
  return (
    <>
      <PageHeader title="Overview" description={`Signed in as ${user.email}`} />
      <div className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/admin/users"
          className="group rounded-xl bg-surface-container-lowest p-lg shadow-sm transition-all hover:scale-101 hover:shadow-md"
        >
          <div className="mb-md flex items-start justify-between gap-sm">
            <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary-container text-primary">
              <Icon name="group" className="text-icon-xl" />
            </span>
            <span
              className={`rounded-full px-sm py-xs font-label-sm text-label-sm ${
                owners.pending > 0
                  ? "bg-info-container text-info"
                  : "bg-success-container text-success"
              }`}
            >
              {owners.pending} pending
            </span>
          </div>
          <p className="text-headline-md text-on-surface">Users</p>
          <p className="mt-xs text-body-sm text-on-surface-variant">
            {owners.approved} approved · {owners.rejected} declined · {owners.total} total
          </p>
        </Link>
        <Link
          href="/admin/cafes"
          className="group rounded-xl bg-surface-container-lowest p-lg shadow-sm transition-all hover:scale-101 hover:shadow-md"
        >
          <div className="mb-md flex items-start justify-between gap-sm">
            <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary-container text-primary">
              <Icon name="storefront" className="text-icon-xl" />
            </span>
            <span className="rounded-full bg-success-container px-sm py-xs font-label-sm text-label-sm text-success">
              {cafes.length - suspendedCafes} active
            </span>
          </div>
          <p className="text-headline-md text-on-surface">Cafés</p>
          <p className="mt-xs text-body-sm text-on-surface-variant">
            {cafes.length} total{suspendedCafes ? ` · ${suspendedCafes} suspended` : ""}
            {cafes[0] ? ` · newest: ${cafes[0].name}` : ""}
          </p>
        </Link>
        <Link
          href="/admin/business"
          className="group rounded-xl bg-surface-container-lowest p-lg shadow-sm transition-all hover:scale-101 hover:shadow-md"
        >
          <div className="mb-md flex items-start justify-between gap-sm">
            <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary-container text-primary">
              <Icon name="category" className="text-icon-xl" />
            </span>
            <span
              aria-label={`${active} of ${types.length} business types active`}
              className={`rounded-full px-sm py-xs font-label-sm text-label-sm ${
                active === 0
                  ? "bg-error-container text-on-error-container"
                  : "bg-success-container text-success"
              }`}
            >
              {active}/{types.length} active
            </span>
          </div>
          <p className="text-headline-md text-on-surface">Business types</p>
          <p className="mt-xs text-body-sm text-on-surface-variant">
            Categories café owners choose when they register.
          </p>
        </Link>
      </div>
    </>
  );
}

export default function AdminHomePage() {
  return (
    <AdminShell active="/admin">
      <Suspense fallback={<p className="text-on-surface-variant">Loading…</p>}>
        <Welcome />
      </Suspense>
    </AdminShell>
  );
}
