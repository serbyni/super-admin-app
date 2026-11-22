import { Suspense } from "react";
import { OwnerIntl } from "@/i18n/owner-intl";
import { requireTenantAccess } from "@/lib/access/server";

/**
 * (tenant) — /<slug>/… pages of ONE café, for its members (owner: active account; staff: per role and shift). Signed out →
 * /login?next=…; anyone else (other owners, pending owners, admins) → their own home.
 */
async function TenantGate({
  params,
  children,
}: {
  params: LayoutProps<"/[tenant]">["params"];
  children: React.ReactNode;
}) {
  const { tenant } = await params;
  await requireTenantAccess(tenant);
  // The owner's dashboard language (Settings → Profile), right-to-left in Arabic.
  return <OwnerIntl>{children}</OwnerIntl>;
}

export default function TenantLayout({ params, children }: LayoutProps<"/[tenant]">) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <TenantGate params={params}>{children}</TenantGate>
    </Suspense>
  );
}
