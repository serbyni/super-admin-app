import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminShell, PageHeader } from "@/components/admin/admin-shell";
import { Icon } from "@/components/ui/icon";
import { formatDateTime } from "@/config/locale";
import { requireAdmin } from "@/lib/auth/admin";
import { serverApi } from "@/lib/data/server-api";
import { languageLabel } from "@/lib/i18n/languages";
import { DecideButtons } from "./decide-buttons";

export const metadata: Metadata = { title: "Languages" };

const TABS = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "declined", label: "Declined" },
  { key: "all", label: "All" },
] as const;

const CHIP = {
  pending: "bg-warning-container text-on-warning-container",
  approved: "bg-success-container text-success",
  declined: "bg-error-container text-on-error-container",
} as const;

async function Requests({
  searchParams,
}: {
  searchParams: PageProps<"/admin/languages">["searchParams"];
}) {
  await requireAdmin();
  const { status: raw } = await searchParams;
  const tab = TABS.find((t) => t.key === raw) ?? TABS[0];
  const requests = await serverApi().languages.adminRequests(tab.key === "all" ? null : tab.key);

  return (
    <>
      <nav aria-label="Status" className="mb-lg flex flex-wrap gap-xs">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "pending" ? "/admin/languages" : `/admin/languages?status=${t.key}`}
            aria-current={t.key === tab.key ? "page" : undefined}
            className={`rounded-full px-md py-xs text-body-sm font-semibold ${
              t.key === tab.key
                ? "bg-primary text-on-primary"
                : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {requests.length === 0 ? (
        <p className="rounded-xl bg-surface-container-lowest p-lg text-on-surface-variant">
          {tab.key === "pending" ? "No pending language requests." : "No requests here."}
        </p>
      ) : (
        <ul className="flex flex-col gap-sm">
          {requests.map((r) => (
            <li
              key={r.id}
              className="flex flex-col gap-sm rounded-xl bg-surface-container-lowest p-lg shadow-sm md:flex-row md:items-center md:justify-between"
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-sm">
                  <span className="text-body-lg font-semibold text-on-surface">
                    {languageLabel(r.locale)}
                  </span>
                  <span
                    className={`rounded-full px-sm py-xs text-caption font-semibold uppercase ${CHIP[r.status]}`}
                  >
                    {r.status}
                  </span>
                </p>
                <p className="text-body-sm text-on-surface-variant">
                  <Link
                    href={`/admin/cafes/${r.cafeSlug}`}
                    className="font-semibold text-primary hover:underline"
                  >
                    {r.cafeName}
                  </Link>
                  {r.ownerEmail ? ` · ${r.ownerEmail}` : ""} · {formatDateTime(r.createdAt)}
                </p>
                {r.note ? <p className="mt-xs text-body-sm text-on-surface">“{r.note}”</p> : null}
                {r.decisionNote ? (
                  <p className="mt-xs flex items-center gap-xs text-caption text-on-surface-variant">
                    <Icon name="reply" className="text-icon-sm" /> {r.decisionNote}
                  </p>
                ) : null}
              </div>
              {r.status === "pending" ? (
                <DecideButtons id={r.id} label={`${languageLabel(r.locale)} for ${r.cafeName}`} />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function LanguagesPage({ searchParams }: PageProps<"/admin/languages">) {
  return (
    <AdminShell active="/admin/languages">
      <PageHeader
        title="Languages"
        description="Requests from café owners for extra menu languages (beyond English, French and Arabic)."
      />
      <Suspense fallback={<div className="min-h-40" />}>
        <Requests searchParams={searchParams} />
      </Suspense>
    </AdminShell>
  );
}
