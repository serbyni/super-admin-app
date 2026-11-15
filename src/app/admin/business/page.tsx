import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminShell, PageHeader } from "@/components/admin/admin-shell";
import { Icon } from "@/components/ui/icon";
import { listBusinessTypesForAdmin } from "./data";
import { SortableBusinessTypes } from "./sortable-table";

export const metadata: Metadata = { title: "Business types" };

async function Notice({
  searchParams,
}: {
  searchParams: PageProps<"/admin/business">["searchParams"];
}) {
  const { saved, deleted } = await searchParams;
  const text = saved ? `Saved “${saved}”.` : deleted ? "Business type deleted." : null;
  if (!text) return null;
  return (
    <div
      role="status"
      className="mb-md flex items-center gap-sm rounded-lg bg-success-container p-sm text-success"
    >
      <Icon name="check_circle" className="text-icon-lg" />
      <span className="text-body-sm font-semibold">{text}</span>
    </div>
  );
}

async function Table() {
  const types = await listBusinessTypesForAdmin();
  if (types.length === 0) {
    return (
      <p className="rounded-xl bg-surface-container-lowest p-lg text-on-surface-variant">
        No business types yet.
      </p>
    );
  }
  // key: remount with fresh server data after create/edit/delete redirects.
  return (
    <SortableBusinessTypes key={types.map((t) => t.id + t.updated_at).join()} initial={types} />
  );
}

export default function BusinessTypesPage({ searchParams }: PageProps<"/admin/business">) {
  return (
    <AdminShell active="/admin/business">
      <PageHeader
        title="Business types"
        description="Categories café owners choose when they register, in this order. Types in use can be deactivated but not deleted."
        actions={
          <Link
            href="/admin/business/new"
            className="inline-flex items-center gap-xs rounded-xl bg-primary px-lg py-sm font-semibold text-on-primary shadow-md transition-all hover:scale-101 hover:bg-primary-container"
          >
            <Icon name="add" className="text-icon-lg" />
            New business type
          </Link>
        }
      />
      <Suspense fallback={null}>
        <Notice searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<p className="text-on-surface-variant">Loading…</p>}>
        <Table />
      </Suspense>
    </AdminShell>
  );
}
