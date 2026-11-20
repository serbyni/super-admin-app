import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { AdminShell, PageHeader } from "@/components/admin/admin-shell";
import { ProfileTab } from "@/components/settings/profile-tab";
import { Icon } from "@/components/ui/icon";
import { requireAdmin } from "@/lib/auth/guards";
import { ROUTES } from "@/lib/auth/routes";

export const metadata: Metadata = { title: "Settings" };

async function Settings({
  searchParams,
}: {
  searchParams: PageProps<"/admin/settings">["searchParams"];
}) {
  const { user } = await requireAdmin(ROUTES.adminSettings);
  setRequestLocale("en"); // admin console: English (ProfileTab is shared with owners)
  const { email } = await searchParams;
  return (
    <>
      <nav
        aria-label="Settings"
        className="mb-lg flex gap-xs border-b border-surface-container-high"
      >
        <span
          aria-current="page"
          className="-mb-px inline-flex items-center gap-xs border-b-2 border-primary px-md py-sm text-body-sm font-semibold text-primary"
        >
          <Icon name="person" className="text-icon-md" />
          Profile
        </span>
      </nav>
      <ProfileTab emailResult={email} pendingEmail={user.new_email ?? null} />
    </>
  );
}

export default function AdminSettingsPage({ searchParams }: PageProps<"/admin/settings">) {
  return (
    <AdminShell active="/admin/settings">
      <PageHeader title="Settings" description="Your super-admin account." />
      <Suspense fallback={<p className="text-on-surface-variant">Loading…</p>}>
        <Settings searchParams={searchParams} />
      </Suspense>
    </AdminShell>
  );
}
