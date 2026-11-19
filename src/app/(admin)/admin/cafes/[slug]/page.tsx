import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminShell, PageHeader } from "@/components/admin/admin-shell";
import { CafeStatusChip } from "@/components/admin/cafe-status-chip";
import { Card, Row } from "@/components/admin/detail-card";
import { Icon } from "@/components/ui/icon";
import { CAFE_LOCALES } from "@/config/cafe-defaults";
import { formatDateTime } from "@/config/locale";
import { requireAdmin } from "@/lib/auth/guards";
import { socialHandle } from "@/lib/cafes/contact";
import { CafePageLink } from "@/components/cafe/cafe-page-link";
import { cafeHost, isValidSlugFormat } from "@/lib/cafes/slug";
import { serverApi } from "@/lib/data/server-api";
import { cafeRootDomain } from "@/lib/env";

export const metadata: Metadata = { title: "Café" };

const COUNTRY = new Intl.DisplayNames(["en"], { type: "region" });
const CURRENCY = new Intl.DisplayNames(["en"], { type: "currency" });

async function Cafe({ params }: { params: PageProps<"/admin/cafes/[slug]">["params"] }) {
  await requireAdmin();
  const { slug } = await params;
  if (!isValidSlugFormat(slug)) notFound();
  const c = await serverApi().cafes.adminGet(slug);
  if (!c) notFound();
  const hasPin = c.latitude !== null && c.longitude !== null;

  return (
    <>
      <Link
        href="/admin/cafes"
        className="mb-sm inline-flex items-center gap-xs text-body-sm font-semibold text-primary hover:text-primary-container"
      >
        <Icon name="arrow_back" className="text-icon-md" flipRtl />
        All cafés
      </Link>
      <PageHeader
        title={c.name}
        description={cafeHost(c.slug, cafeRootDomain())}
        actions={
          <div className="flex flex-wrap items-center gap-sm">
            <CafeStatusChip status={c.status} />
            <CafePageLink slug={c.slug} />
          </div>
        }
      />
      <div className="grid grid-cols-1 gap-md lg:grid-cols-2">
        <Card title="Café" icon="storefront">
          <Row label="Name">{c.name}</Row>
          <Row label="Address">
            <CafePageLink slug={c.slug} variant="inline">
              {cafeHost(c.slug, cafeRootDomain())}
            </CafePageLink>
          </Row>
          <Row label="Created">{formatDateTime(c.createdAt)}</Row>
          <Row label="Last updated">{formatDateTime(c.updatedAt)}</Row>
          <Row label="Members">{c.membersCount}</Row>
        </Card>
        <Card title="Owner" icon="person">
          <Row label="Name">{c.ownerName}</Row>
          <Row label="Email">{c.ownerEmail}</Row>
          <Row label="Phone">{c.ownerPhone}</Row>
          <Row label="Application">
            {c.ownerUserId ? (
              <Link
                href={`/admin/users/${c.ownerUserId}`}
                className="inline-flex items-center gap-xs font-semibold text-primary hover:text-primary-container"
              >
                Open application
                <Icon name="chevron_right" className="text-icon-md" flipRtl />
              </Link>
            ) : null}
          </Row>
        </Card>
        <Card title="Contact" icon="call">
          <Row label="Phone">{c.phone}</Row>
          <Row label="Email">{c.contactEmail}</Row>
          <Row label="Facebook">
            {c.facebook ? (
              <a
                href={c.facebook}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-primary hover:text-primary-container"
              >
                {socialHandle(c.facebook)}
              </a>
            ) : null}
          </Row>
          <Row label="Instagram">
            {c.instagram ? (
              <a
                href={c.instagram}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-primary hover:text-primary-container"
              >
                {socialHandle(c.instagram)}
              </a>
            ) : null}
          </Row>
        </Card>
        <Card title="Location" icon="location_on">
          <Row label="Country">{COUNTRY.of(c.countryCode) ?? c.countryCode}</Row>
          <Row label="City">{c.city}</Row>
          <Row label="Street address">{c.address}</Row>
          <Row label="Map">
            {hasPin ? (
              <a
                href={`https://www.openstreetmap.org/?mlat=${c.latitude}&mlon=${c.longitude}#map=17/${c.latitude}/${c.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-xs font-semibold text-primary hover:text-primary-container"
              >
                Open map
                <Icon name="open_in_new" className="text-icon-md" />
              </a>
            ) : null}
          </Row>
        </Card>
        <Card title="Settings" icon="tune">
          <Row label="Currency">
            {c.currency} — {CURRENCY.of(c.currency) ?? c.currency}
          </Row>
          <Row label="Time zone">{c.timezone.replaceAll("_", " ")}</Row>
          <Row label="Menu language">
            {CAFE_LOCALES.find((l) => l.value === c.locale)?.label ?? c.locale}
          </Row>
          <Row label="Brand colour">
            <span className="inline-flex items-center gap-xs">
              <span
                className="h-4 w-4 rounded-full border border-outline-variant"
                style={{ backgroundColor: c.seed }}
              />
              <span className="font-mono">{c.seed}</span>
            </span>
          </Row>
        </Card>
        <Card title="Agreements" icon="gavel">
          <Row label="Terms of Service">Version {c.termsVersion}</Row>
          <Row label="Data Processing Agreement">Version {c.dpaVersion}</Row>
          <Row label="Accepted">{formatDateTime(c.agreedAt)}</Row>
        </Card>
      </div>
      <p className="mt-lg flex items-start gap-xs text-caption text-on-surface-variant">
        <Icon name="lock" className="text-icon-sm" />
        Menus, orders and customers belong to the café and are not shown here (Serbi is the data
        processor).
      </p>
    </>
  );
}

export default function AdminCafePage({ params }: PageProps<"/admin/cafes/[slug]">) {
  return (
    <AdminShell active="/admin/cafes">
      <Suspense fallback={<p className="text-on-surface-variant">Loading…</p>}>
        <Cafe params={params} />
      </Suspense>
    </AdminShell>
  );
}
