import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminShell, PageHeader } from "@/components/admin/admin-shell";
import { OwnerStatusChip } from "@/components/admin/owner-status-chip";
import { Icon } from "@/components/ui/icon";
import { formatDateTime } from "@/config/locale";
import { requireAdmin } from "@/lib/auth/admin";
import type { OwnerStatus } from "@/lib/auth/owner-status";
import { serverApi } from "@/lib/data/server-api";

export const metadata: Metadata = { title: "Users" };

const TABS: { key: string; label: string; status?: OwnerStatus }[] = [
  { key: "pending", label: "Pending", status: "pending_approval" },
  { key: "approved", label: "Approved", status: "approved" },
  { key: "declined", label: "Declined", status: "rejected" },
  { key: "all", label: "All" },
];

async function Users({
  searchParams,
}: {
  searchParams: PageProps<"/admin/users">["searchParams"];
}) {
  await requireAdmin();
  const { tab: rawTab } = await searchParams;
  const tab = TABS.find((t) => t.key === rawTab) ?? TABS[0];
  const api = serverApi();
  const [users, stats] = await Promise.all([api.users.list(tab.status), api.users.stats()]);
  const counts: Record<string, number> = {
    pending: stats.pending,
    approved: stats.approved,
    declined: stats.rejected,
    all: stats.total,
  };

  return (
    <>
      <nav aria-label="Filter" className="mb-md flex flex-wrap gap-xs">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "pending" ? "/admin/users" : `/admin/users?tab=${t.key}`}
            aria-current={t.key === tab.key ? "page" : undefined}
            className={`inline-flex items-center gap-xs rounded-full px-md py-xs text-body-sm font-semibold transition-colors ${
              t.key === tab.key
                ? "bg-primary text-on-primary"
                : "bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            {t.label}
            <span className="rounded-full bg-surface-container-high px-xs text-caption text-on-surface">
              {counts[t.key]}
            </span>
          </Link>
        ))}
      </nav>

      {users.length === 0 ? (
        <p className="rounded-xl bg-surface-container-lowest p-lg text-on-surface-variant">
          {tab.key === "pending" ? "No applications waiting. 🎉" : "No users in this list."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-surface-container-lowest shadow-sm">
          <table className="w-full text-start text-body-sm">
            <thead className="bg-surface-container-low text-on-surface-variant">
              <tr>
                <th className="px-md py-sm text-start font-semibold">Business</th>
                <th className="px-md py-sm text-start font-semibold">Owner</th>
                <th className="hidden px-md py-sm text-start font-semibold md:table-cell">
                  Location
                </th>
                <th className="hidden px-md py-sm text-start font-semibold lg:table-cell">
                  Submitted
                </th>
                <th className="px-md py-sm text-start font-semibold">Status</th>
                <th className="px-md py-sm" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.userId}
                  className="border-t border-surface-container-high hover:bg-surface-container-low"
                >
                  <td className="px-md py-sm">
                    <p className="font-semibold text-on-surface">{u.businessName ?? "—"}</p>
                    <p className="text-caption text-on-surface-variant">{u.businessType ?? ""}</p>
                  </td>
                  <td className="px-md py-sm">
                    <p className="text-on-surface">{u.fullName ?? "—"}</p>
                    <p className="text-caption text-on-surface-variant">{u.email}</p>
                  </td>
                  <td className="hidden px-md py-sm text-on-surface-variant md:table-cell">
                    {[u.city, u.countryCode].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="hidden px-md py-sm whitespace-nowrap text-on-surface-variant lg:table-cell">
                    {formatDateTime(u.submittedAt ?? u.createdAt)}
                  </td>
                  <td className="px-md py-sm">
                    <OwnerStatusChip status={u.status} />
                  </td>
                  <td className="px-md py-sm text-end">
                    <Link
                      href={`/admin/users/${u.userId}`}
                      className="inline-flex items-center gap-xs rounded-lg px-sm py-xs font-semibold text-primary hover:bg-secondary-container"
                    >
                      {u.status === "pending_approval" ? "Review" : "Open"}
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

export default function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  return (
    <AdminShell active="/admin/users">
      <PageHeader
        title="Users"
        description="Café owner applications. Review pending applications, then approve or decline — the owner is emailed automatically."
      />
      <Suspense fallback={<p className="text-on-surface-variant">Loading…</p>}>
        <Users searchParams={searchParams} />
      </Suspense>
    </AdminShell>
  );
}
