import "server-only";
import { unwrap } from "../errors";
import type { LazyDb } from "../types";
import { toAppNotification, type AppNotification } from "./notification-types";

export type { AppNotification, NotificationType } from "./notification-types";

/** In-app notifications of the signed-in user (owners and super admins). */
export class NotificationsService {
  constructor(private readonly db: LazyDb) {}

  async list(limit = 20): Promise<AppNotification[]> {
    const rows = unwrap(
      "my_notifications",
      await (await this.db()).rpc("my_notifications", { p_limit: limit }),
    );
    return rows.map(toAppNotification);
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
