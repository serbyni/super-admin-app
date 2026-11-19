import type { AppNotification } from "@/lib/data/services/notification-types";

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
    case "cafe_created":
      return {
        icon: "storefront",
        title: "New café created",
        body: `${business} finished onboarding and is live.`,
        href: n.data.cafeSlug ? `/admin/cafes/${n.data.cafeSlug}` : "/admin/cafes",
      };
    default:
      return { icon: "notifications", title: "Update", body: business, href: "/pending" };
  }
}
