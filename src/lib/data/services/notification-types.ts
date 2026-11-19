export type NotificationType =
  "register_new_user" | "admin_approve_user" | "admin_declined_user" | "cafe_created";

export type AppNotification = {
  id: string;
  type: NotificationType;
  data: { businessName?: string; ownerUserId?: string; cafeSlug?: string };
  createdAt: string;
  readAt: string | null;
};

/** Map a raw row / realtime payload (snake_case data) to AppNotification. */
export function toAppNotification(r: {
  id: string;
  type: string;
  data: unknown;
  created_at: string;
  read_at?: string | null;
}): AppNotification {
  const d = (r.data ?? {}) as Record<string, unknown>;
  return {
    id: r.id,
    type: r.type as NotificationType,
    data: {
      businessName: typeof d.business_name === "string" ? d.business_name : undefined,
      ownerUserId: typeof d.owner_user_id === "string" ? d.owner_user_id : undefined,
      cafeSlug: typeof d.cafe_slug === "string" ? d.cafe_slug : undefined,
    },
    createdAt: r.created_at,
    readAt: r.read_at ?? null,
  };
}
