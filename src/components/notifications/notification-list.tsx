import { openNotification } from "./actions";
import { Icon } from "@/components/ui/icon";
import { formatDateTime } from "@/config/locale";
import type { AppNotification } from "@/lib/data/services/notifications";

/** Text, icon and link of each notification type. */
export function describeNotification(n: AppNotification): {
  icon: string;
  title: string;
  body: string;
  href: string;
} {
  const business = n.data.businessName ?? "A café";
  switch (n.type) {
    case "register_new_user":
      return {
        icon: "person_add",
        title: "New application",
        body: `${business} is waiting for review.`,
        href: n.data.ownerUserId ? `/admin/users/${n.data.ownerUserId}` : "/admin/users",
      };
    case "admin_approve_user":
      return {
        icon: "verified",
        title: "You're approved!",
        body: `${business} is approved on Serbi. Café setup is coming next.`,
        href: "/pending",
      };
    default:
      return { icon: "notifications", title: "Update", body: business, href: "/pending" };
  }
}

export function NotificationList({ items }: { items: AppNotification[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl bg-surface-container-lowest p-lg text-on-surface-variant">
        No notifications yet.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-surface-container-high overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm">
      {items.map((n) => {
        const d = describeNotification(n);
        const unread = !n.readAt;
        return (
          <li key={n.id}>
            <form action={openNotification}>
              <input type="hidden" name="id" value={n.id} />
              <input type="hidden" name="href" value={d.href} />
              <button
                type="submit"
                className={`flex w-full items-start gap-md px-md py-sm text-start transition-colors hover:bg-surface-container-low ${unread ? "bg-secondary-container/40" : ""}`}
              >
                <span className="mt-xs flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary-container text-primary">
                  <Icon name={d.icon} className="text-icon-lg" />
                </span>
                <span className="flex-1">
                  <span className="flex items-center gap-xs text-body-sm font-semibold text-on-surface">
                    {d.title}
                    {unread ? (
                      <span aria-label="unread" className="h-2 w-2 rounded-full bg-cta" />
                    ) : null}
                  </span>
                  <span className="block text-body-sm text-on-surface-variant">{d.body}</span>
                  <span className="block text-caption text-outline">
                    {formatDateTime(n.createdAt)}
                  </span>
                </span>
                <Icon
                  name="chevron_right"
                  className="mt-sm text-icon-md text-on-surface-variant"
                  flipRtl
                />
              </button>
            </form>
          </li>
        );
      })}
    </ul>
  );
}
