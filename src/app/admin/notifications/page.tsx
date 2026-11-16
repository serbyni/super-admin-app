import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminShell, PageHeader } from "@/components/admin/admin-shell";
import { NotificationList } from "@/components/notifications/notification-list";
import { Icon } from "@/components/ui/icon";
import { requireAdmin } from "@/lib/auth/admin";
import { serverApi } from "@/lib/data/server-api";
import { markAllNotificationsRead } from "@/components/notifications/actions";

export const metadata: Metadata = { title: "Notifications" };

async function List() {
  await requireAdmin();
  const items = await serverApi().notifications.list(50);
  return (
    <>
      {items.some((n) => !n.readAt) ? (
        <form action={markAllNotificationsRead} className="mb-md flex justify-end">
          <input type="hidden" name="back" value="/admin/notifications" />
          <button
            type="submit"
            className="inline-flex items-center gap-xs rounded-lg px-sm py-xs text-body-sm font-semibold text-primary hover:bg-secondary-container"
          >
            <Icon name="done_all" className="text-icon-md" />
            Mark all as read
          </button>
        </form>
      ) : null}
      <NotificationList items={items} />
    </>
  );
}

export default function NotificationsPage() {
  return (
    <AdminShell active="/admin/notifications">
      <PageHeader title="Notifications" description="New applications and other platform events." />
      <Suspense fallback={<p className="text-on-surface-variant">Loading…</p>}>
        <List />
      </Suspense>
    </AdminShell>
  );
}
