import { tenantSettings } from "@/lib/auth/routes";
import type { AppNotification } from "@/lib/data/services/notification-types";
import { languageLabel } from "@/lib/i18n/languages";

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
    case "language_requested": {
      const lang = n.data.locale ? languageLabel(n.data.locale) : "a language";
      return {
        icon: "translate",
        title: "Language request",
        body: `${n.data.cafeName ?? "A café"} asks for ${lang}${n.data.note ? ` — “${n.data.note}”` : "."}`,
        href: "/admin/languages",
      };
    }
    case "language_request_decided": {
      const lang = n.data.locale ? languageLabel(n.data.locale) : "your language";
      return {
        icon: n.data.approved ? "translate" : "do_not_disturb_on",
        title: n.data.approved ? `${lang} added` : `${lang} request declined`,
        body: n.data.approved
          ? `Your café can now offer ${lang}. Add your translations in Menu and Website.`
          : `Serbi declined your request${n.data.note ? `: “${n.data.note}”` : "."}`,
        href: n.data.cafeSlug ? `${tenantSettings(n.data.cafeSlug)}?tab=languages` : "/auth/home",
      };
    }
    default:
      return { icon: "notifications", title: "Update", body: business, href: "/pending" };
  }
}
