import en from "../../../messages/en.json";
import { tenantSettings } from "@/lib/auth/routes";
import type { AppNotification } from "@/lib/data/services/notification-types";
import { languageLabel } from "@/lib/i18n/languages";

type Key = keyof typeof en.notifications;
/** Translator of the "notifications" namespace (useTranslations / getTranslations). */
export type NotificationT = (key: Key, values?: Record<string, string>) => string;

/** English (admin console, and anywhere no translator is given). */
const enT: NotificationT = (key, values) =>
  en.notifications[key].replace(/\{(\w+)\}/g, (_, k: string) => values?.[k] ?? `{${k}}`);

/**
 * Text, icon and link of each notification type, in the reader's language (`t` + `locale`;
 * default English).
 */
export function describeNotification(
  n: AppNotification,
  t: NotificationT = enT,
  locale = "en",
): { icon: string; title: string; body: string; href: string } {
  const business = n.data.businessName ?? t("aCafe");
  switch (n.type) {
    case "register_new_user":
      return {
        icon: "person_add",
        title: t("newApplication"),
        body: t("waitingReview", { business }),
        href: n.data.ownerUserId ? `/admin/users/${n.data.ownerUserId}` : "/admin/users",
      };
    case "admin_approve_user":
      return {
        icon: "verified",
        title: t("approvedTitle"),
        body: t("approvedBody", { business }),
        href: "/pending",
      };
    case "cafe_created":
      return {
        icon: "storefront",
        title: t("cafeCreatedTitle"),
        body: t("cafeCreatedBody", { business }),
        href: n.data.cafeSlug ? `/admin/cafes/${n.data.cafeSlug}` : "/admin/cafes",
      };
    case "language_requested": {
      const language = n.data.locale ? languageLabel(n.data.locale, locale) : t("aLanguage");
      const cafe = n.data.cafeName ?? t("aCafe");
      return {
        icon: "translate",
        title: t("languageRequestTitle"),
        body: n.data.note
          ? t("languageRequestBodyNote", { cafe, language, note: n.data.note })
          : t("languageRequestBody", { cafe, language }),
        href: "/admin/languages",
      };
    }
    case "language_request_decided": {
      const language = n.data.locale ? languageLabel(n.data.locale, locale) : t("yourLanguage");
      return {
        icon: n.data.approved ? "translate" : "do_not_disturb_on",
        title: n.data.approved
          ? t("languageAdded", { language })
          : t("languageDeclined", { language }),
        body: n.data.approved
          ? t("languageAddedBody", { language })
          : n.data.note
            ? t("languageDeclinedBodyNote", { note: n.data.note })
            : t("languageDeclinedBody"),
        href: n.data.cafeSlug ? `${tenantSettings(n.data.cafeSlug)}?tab=languages` : "/auth/home",
      };
    }
    default:
      return { icon: "notifications", title: t("update"), body: business, href: "/pending" };
  }
}
