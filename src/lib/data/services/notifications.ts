import "server-only";
import { unwrap } from "../errors";
import type { LazyDb } from "../types";

export type NotificationType = "register_new_user" | "admin_approve_user" | "admin_declined_user";

export type AppNotification = {
  id: string;
  type: NotificationType;
  data: { businessName?: string; ownerUserId?: string };
  createdAt: string;
  readAt: string | null;
};

/** In-app notifications of the signed-in user (owners and super admins). */
export class NotificationsService {
  constructor(private readonly db: LazyDb) {}

  async list(limit = 20): Promise<AppNotification[]> {
    const rows = unwrap(
      "my_notifications",
      await (await this.db()).rpc("my_notifications", { p_limit: limit }),
    );
    return rows.map((r) => {
      const d = (r.data ?? {}) as Record<string, unknown>;
      return {
        id: r.id,
        type: r.type as NotificationType,
        data: {
          businessName: typeof d.business_name === "string" ? d.business_name : undefined,
          ownerUserId: typeof d.owner_user_id === "string" ? d.owner_user_id : undefined,
        },
        createdAt: r.created_at,
        readAt: r.read_at,
      };
    });
  }

  async unreadCount(): Promise<number> {
    return unwrap(
      "my_unread_notification_count",
      await (await this.db()).rpc("my_unread_notification_count"),
    );
  }

  /** Mark the given notifications (or all, when omitted) as read. */
  async markRead(ids?: string[]): Promise<void> {
    unwrap(
      "mark_my_notifications_read",
      await (await this.db()).rpc("mark_my_notifications_read", ids ? { p_ids: ids } : {}),
    );
  }
}
