import { Suspense } from "react";
import { OwnerIntl } from "@/i18n/owner-intl";
import { requireTenantOwner } from "@/lib/auth/guards";

/**
 * (tenant) — /<slug>/… pages of ONE café, for its ACTIVE owner only. Signed out →
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
  await requireTenantOwner(tenant);
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
