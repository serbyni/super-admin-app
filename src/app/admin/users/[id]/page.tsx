import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { AdminShell, PageHeader } from "@/components/admin/admin-shell";
import { OwnerStatusChip } from "@/components/admin/owner-status-chip";
import { Icon } from "@/components/ui/icon";
import { formatDateTime } from "@/config/locale";
import { requireAdmin } from "@/lib/auth/admin";
import { serverApi } from "@/lib/data/server-api";
import { DecisionPanel } from "./decision-panel";

export const metadata: Metadata = { title: "Application" };

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-xs py-sm sm:grid-cols-3">
      <dt className="text-body-sm text-on-surface-variant">{label}</dt>
      <dd className="text-body-sm text-on-surface sm:col-span-2">{children ?? "—"}</dd>
    </div>
  );
}

function Card({ title, icon, children }: { title: string; icon: string; children: ReactNode }) {
  return (
    <section className="rounded-xl bg-surface-container-lowest p-lg shadow-sm">
      <h2 className="mb-sm flex items-center gap-sm text-headline-md text-on-surface">
        <Icon name={icon} className="text-icon-xl text-primary" />
        {title}
      </h2>
      <dl className="divide-y divide-surface-container-high">{children}</dl>
    </section>
  );
}

async function Application({
  params,
  searchParams,
}: {
  params: PageProps<"/admin/users/[id]">["params"];
  searchParams: PageProps<"/admin/users/[id]">["searchParams"];
}) {
  await requireAdmin();
  const { id } = await params;
  const { decided } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const u = await serverApi().users.get(id);
  if (!u) notFound();
  const hasPin = u.latitude !== null && u.longitude !== null;

  return (
    <>
      <PageHeader
        title={u.businessName ?? "Application"}
        description={`${u.fullName ?? "Unknown owner"} · ${u.email}`}
        actions={<OwnerStatusChip status={u.status} />}
      />
      {decided ? (
        <div
          role="status"
          className="mb-md flex items-center gap-sm rounded-lg bg-success-container p-sm text-success"
        >
          <Icon name="mark_email_read" className="text-icon-lg" />
          <span className="text-body-sm font-semibold">
            {decided === "approved" ? "Approved." : "Declined."} The owner is being emailed.
          </span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-md xl:grid-cols-3">
        <div className="flex flex-col gap-md xl:col-span-2">
          <Card title="Owner" icon="person">
            <Row label="Full name">{u.fullName}</Row>
            <Row label="Email">
              {u.email}{" "}
              <span className={u.emailConfirmed ? "text-success" : "text-error"}>
                ({u.emailConfirmed ? "verified" : "not verified"})
              </span>
            </Row>
            <Row label="Phone">{u.phone}</Row>
            <Row label="Signed up with">{u.signupProvider}</Row>
            <Row label="Language">{u.locale.toUpperCase()}</Row>
          </Card>
          <Card title="Business" icon="storefront">
            <Row label="Name">{u.businessName}</Row>
            <Row label="Type">{u.businessType}</Row>
            <Row label="Address">
              {u.formattedAddress ??
                ([u.street, u.postalCode, u.city].filter(Boolean).join(", ") || null)}
            </Row>
            <Row label="City / country">
              {[u.city, u.region, u.country ?? u.countryCode].filter(Boolean).join(" · ")}
            </Row>
            <Row label="Map">
              {hasPin ? (
                <a
                  href={`https://www.openstreetmap.org/?mlat=${u.latitude}&mlon=${u.longitude}#map=18/${u.latitude}/${u.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-xs font-semibold text-primary hover:underline"
                >
                  {u.latitude}, {u.longitude}
                  <Icon name="open_in_new" className="text-icon-sm" />
                </a>
              ) : null}
            </Row>
          </Card>
        </div>

        <div className="flex flex-col gap-md">
          {u.status === "pending_approval" ? (
            <DecisionPanel userId={u.userId} businessName={u.businessName ?? "this business"} />
          ) : null}
          <Card title="Timeline" icon="history">
            <Row label="Signed up">{formatDateTime(u.createdAt)}</Row>
            <Row label="Submitted">{formatDateTime(u.submittedAt)}</Row>
            <Row label="Decided">
              {u.decidedAt
                ? `${formatDateTime(u.decidedAt)}${u.decidedByEmail ? ` by ${u.decidedByEmail}` : ""}`
                : null}
            </Row>
            {u.rejectionReason ? <Row label="Decline reason">{u.rejectionReason}</Row> : null}
          </Card>
          <Link
            href="/admin/users"
            className="inline-flex items-center gap-xs text-body-sm font-semibold text-on-surface-variant hover:text-on-surface"
          >
            <Icon name="arrow_back" className="text-icon-md" flipRtl />
            Back to users
          </Link>
        </div>
      </div>
    </>
  );
}

export default function ApplicationPage({ params, searchParams }: PageProps<"/admin/users/[id]">) {
  return (
    <AdminShell active="/admin/users">
      <Suspense fallback={<p className="text-on-surface-variant">Loading…</p>}>
        <Application params={params} searchParams={searchParams} />
      </Suspense>
    </AdminShell>
  );
}
