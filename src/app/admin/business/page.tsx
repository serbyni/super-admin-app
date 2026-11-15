import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminShell, PageHeader } from "@/components/admin/admin-shell";
import { Icon } from "@/components/ui/icon";
import { localizedName } from "@/lib/business-types/schema";
import { listBusinessTypesForAdmin } from "./data";
import { DeleteBusinessTypeButton } from "./delete-button";

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
  return (
    <div className="overflow-x-auto rounded-xl bg-surface-container-lowest shadow-sm">
      <table className="w-full min-w-max text-start text-body-sm">
        <thead className="bg-surface-container-low font-label-sm text-label-sm tracking-wider text-on-surface-variant uppercase">
          <tr>
            <th className="px-md py-sm text-start">Type</th>
            <th className="px-md py-sm text-start">Code</th>
            <th className="px-md py-sm text-start">FR / AR</th>
            <th className="px-md py-sm text-end">Order</th>
            <th className="px-md py-sm text-end">Owners</th>
            <th className="px-md py-sm text-start">Status</th>
            <th className="px-md py-sm text-end">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-container-high">
          {types.map((t) => (
            <tr key={t.id} className="hover:bg-surface-container-low/60">
              <td className="px-md py-sm">
                <span className="flex items-center gap-sm font-semibold text-on-surface">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary-container text-primary">
                    <Icon name={t.icon} className="text-icon-md" />
                  </span>
                  {localizedName(t.name)}
                </span>
              </td>
              <td className="px-md py-sm font-mono text-on-surface-variant">{t.slug}</td>
              <td className="px-md py-sm text-on-surface-variant">
                {t.name.fr ?? "—"} · <span dir="rtl">{t.name.ar ?? "—"}</span>
              </td>
              <td className="px-md py-sm text-end tabular-nums">{t.sort_order}</td>
              <td className="px-md py-sm text-end tabular-nums">{t.owners_count}</td>
              <td className="px-md py-sm">
                <span
                  className={`rounded-full px-sm py-xs font-label-sm text-label-sm uppercase ${
                    t.is_active
                      ? "bg-success-container text-success"
                      : "bg-surface-container-high text-on-surface-variant"
                  }`}
                >
                  {t.is_active ? "Active" : "Inactive"}
                </span>
              </td>
              <td className="px-md py-sm">
                <div className="flex items-start justify-end gap-xs">
                  <Link
                    href={`/admin/business/${t.id}`}
                    className="inline-flex items-center gap-xs rounded-lg px-sm py-xs text-body-sm font-semibold text-info transition-colors hover:bg-info-container"
                  >
                    <Icon name="edit" className="text-icon-md" />
                    Edit
                  </Link>
                  <DeleteBusinessTypeButton
                    id={t.id}
                    name={localizedName(t.name)}
                    inUse={t.owners_count > 0}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function BusinessTypesPage({ searchParams }: PageProps<"/admin/business">) {
  return (
    <AdminShell active="/admin/business">
      <PageHeader
        title="Business types"
        description="Categories café owners choose when they register. Types in use can be deactivated but not deleted."
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
