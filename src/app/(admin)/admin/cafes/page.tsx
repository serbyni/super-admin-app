import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminShell, PageHeader } from "@/components/admin/admin-shell";
import { CafeStatusChip } from "@/components/admin/cafe-status-chip";
import { Icon } from "@/components/ui/icon";
import { formatDateTime } from "@/config/locale";
import { requireAdmin } from "@/lib/auth/admin";
import { cafeHost } from "@/lib/cafes/slug";
import { serverApi } from "@/lib/data/server-api";
import { cafeRootDomain } from "@/lib/env";

export const metadata: Metadata = { title: "Cafés" };

const COUNTRY = new Intl.DisplayNames(["en"], { type: "region" });

async function Cafes({
  searchParams,
}: {
  searchParams: PageProps<"/admin/cafes">["searchParams"];
}) {
  await requireAdmin();
  const { q: rawQ } = await searchParams;
  const q = (typeof rawQ === "string" ? rawQ : "").trim().toLowerCase();
  const all = await serverApi().cafes.adminList();
  const cafes = q
    ? all.filter((c) =>
        [c.name, c.slug, c.city, c.ownerEmail, c.ownerName].some((v) =>
          v?.toLowerCase().includes(q),
        ),
      )
    : all;
  const root = cafeRootDomain();
  const suspended = all.filter((c) => c.status === "suspended").length;

  return (
    <>
      <div className="mb-md flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-body-sm text-on-surface-variant">
          {all.length} café{all.length === 1 ? "" : "s"}
          {suspended ? ` · ${suspended} suspended` : ""}
        </p>
        <form
          role="search"
          className="flex w-full items-center gap-xs rounded-lg border border-outline-variant bg-surface-container-lowest px-sm focus-within:border-primary sm:w-80"
        >
          <Icon name="search" className="text-icon-lg text-on-surface-variant" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            aria-label="Search cafés"
            placeholder="Name, address, city or owner"
            className="min-w-0 flex-1 bg-transparent py-sm text-body-sm text-on-surface placeholder:text-outline focus:outline-none"
          />
        </form>
      </div>

      {cafes.length === 0 ? (
        <p className="rounded-xl bg-surface-container-lowest p-lg text-on-surface-variant">
          {q
            ? `No café matches “${q}”.`
            : "No cafés yet. They appear here when an approved owner finishes onboarding."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-surface-container-lowest shadow-sm">
          <table className="w-full text-start text-body-sm">
            <thead className="bg-surface-container-low text-on-surface-variant">
              <tr>
                <th className="px-md py-sm text-start font-semibold">Café</th>
                <th className="px-md py-sm text-start font-semibold">Owner</th>
                <th className="hidden px-md py-sm text-start font-semibold md:table-cell">
                  Location
                </th>
                <th className="hidden px-md py-sm text-start font-semibold lg:table-cell">
                  Created
                </th>
                <th className="px-md py-sm text-start font-semibold">Status</th>
                <th className="px-md py-sm" />
              </tr>
            </thead>
            <tbody>
              {cafes.map((c) => (
                <tr
                  key={c.id}
                  className="border-t border-surface-container-high hover:bg-surface-container-low"
                >
                  <td className="px-md py-sm">
                    <p className="font-semibold text-on-surface">{c.name}</p>
                    <p className="text-caption text-on-surface-variant">{cafeHost(c.slug, root)}</p>
                  </td>
                  <td className="px-md py-sm">
                    <p className="text-on-surface">{c.ownerName ?? "—"}</p>
                    <p className="text-caption text-on-surface-variant">{c.ownerEmail ?? ""}</p>
                  </td>
                  <td className="hidden px-md py-sm text-on-surface-variant md:table-cell">
                    {[c.city, COUNTRY.of(c.countryCode)].filter(Boolean).join(", ")}
                  </td>
                  <td className="hidden px-md py-sm whitespace-nowrap text-on-surface-variant lg:table-cell">
                    {formatDateTime(c.createdAt)}
                  </td>
                  <td className="px-md py-sm">
                    <CafeStatusChip status={c.status} />
                  </td>
                  <td className="px-md py-sm text-end">
                    <Link
                      href={`/admin/cafes/${c.slug}`}
                      className="inline-flex items-center gap-xs rounded-lg px-sm py-xs font-semibold text-primary hover:bg-secondary-container"
                    >
                      Open
                      <Icon name="chevron_right" className="text-icon-md" flipRtl />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function CafesPage({ searchParams }: PageProps<"/admin/cafes">) {
  return (
    <AdminShell active="/admin/cafes">
      <PageHeader
        title="Cafés"
        description="Every café on Serbi. Platform data only — menus, orders and customers belong to each café."
      />
      <Suspense fallback={<p className="text-on-surface-variant">Loading…</p>}>
        <Cafes searchParams={searchParams} />
      </Suspense>
    </AdminShell>
  );
}
