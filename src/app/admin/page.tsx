import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminShell, PageHeader } from "@/components/admin/admin-shell";
import { Icon } from "@/components/ui/icon";
import { requireAdmin } from "@/lib/auth/admin";

export const metadata: Metadata = { title: "Admin" };

async function Welcome() {
  const { user } = await requireAdmin();
  return (
    <>
      <PageHeader title="Overview" description={`Signed in as ${user.email}`} />
      <div className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/admin/business"
          className="group rounded-xl bg-surface-container-lowest p-lg shadow-sm transition-all hover:scale-101 hover:shadow-md"
        >
          <span className="mb-md flex h-12 w-12 items-center justify-center rounded-lg bg-secondary-container text-primary">
            <Icon name="category" className="text-icon-xl" />
          </span>
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
