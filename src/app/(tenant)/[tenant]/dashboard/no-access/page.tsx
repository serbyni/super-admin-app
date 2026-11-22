import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader, TenantShell } from "@/components/tenant/tenant-shell";
import { Icon } from "@/components/ui/icon";
import { applyOwnerLocale } from "@/i18n/owner-locale";
import { sectionHref, visibleSections } from "@/lib/access/permissions";
import { requireTenantAccess } from "@/lib/access/server";
import { tenantDashboard } from "@/lib/auth/routes";
import { serverApi } from "@/lib/data/server-api";

export async function generateMetadata(): Promise<Metadata> {
  await applyOwnerLocale();
  return { title: (await getTranslations("access"))("metaTitle") };
}

/**
 * Where a member lands when their role can't open a page, or when they are off shift (then
 * nothing opens until their next shift; Settings → Profile stays available).
 */
async function NoAccess({
  params,
}: {
  params: PageProps<"/[tenant]/dashboard/no-access">["params"];
}) {
  const { tenant } = await params;
  const access = await requireTenantAccess(tenant);
  await applyOwnerLocale();
  const [t, tn] = await Promise.all([getTranslations("access"), getTranslations("nav")]);
  const cafe = await serverApi().cafes.mine(tenant);
  if (!cafe) notFound();
  const off = !access.onShift;
  const next = access.nextShift;
  const days = t("days").split("|");
  const when = next
    ? next.inDays === 0
      ? t("today")
      : next.inDays === 1
        ? t("tomorrow")
        : days[next.day]
    : null;
  const sections = visibleSections(access.permissions);

  return (
    <TenantShell cafe={cafe} email={access.user.email} active="no-access">
      <PageHeader title={off ? t("offShiftTitle") : t("title")} />
      <section className="flex max-w-card-md flex-col gap-md rounded-xl bg-surface-container-lowest p-lg shadow-sm">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
          <Icon name={off ? "schedule" : "lock"} className="text-icon-xl" />
        </span>
        <p className="text-body-md text-on-surface">{off ? t("offShiftBody") : t("body")}</p>
        {off && next && when ? (
          <p className="rounded-lg bg-surface-container-low px-md py-sm text-body-md font-semibold text-on-surface">
            {t("nextShift", { name: next.name, when, time: next.starts })}
          </p>
        ) : off ? (
          <p className="text-body-sm text-on-surface-variant">{t("noNextShift")}</p>
        ) : null}
        {sections.length > 0 && (
          <div className="flex flex-wrap gap-sm">
            {sections.map((s) => (
              <Link
                key={s}
                href={
                  s === "settings"
                    ? `${sectionHref(tenantDashboard(tenant), s)}?tab=profile`
                    : sectionHref(tenantDashboard(tenant), s)
                }
                className="inline-flex items-center gap-xs rounded-full bg-surface-container px-md py-xs text-body-sm font-semibold text-on-surface hover:bg-surface-container-high"
              >
                {s === "settings" && off ? t("profile") : tn(s)}
                <Icon name="arrow_forward" className="text-icon-md" flipRtl />
              </Link>
            ))}
          </div>
        )}
      </section>
    </TenantShell>
  );
}

export default function NoAccessPage({ params }: PageProps<"/[tenant]/dashboard/no-access">) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <NoAccess params={params} />
    </Suspense>
  );
}
