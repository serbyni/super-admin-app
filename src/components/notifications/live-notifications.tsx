"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useToast } from "@/components/ui/toast";
import { browserApi } from "@/lib/data/browser-api";
import { describeNotification } from "./describe";

/**
 * Subscribes to the signed-in user's live notifications. On each new one: refreshes the current
 * page (badges, lists, status) and shows a toast linking to its target.
 */
export function LiveNotifications({ userId }: { userId: string }) {
  const router = useRouter();
  const toast = useToast();
  const t = useTranslations("notifications");
  const locale = useLocale();

  useEffect(() => {
    return browserApi().subscribeToNotifications(userId, (n) => {
      const d = describeNotification(n, t, locale);
      toast.show({
        id: `notification-${n.id}`,
        variant:
          n.type === "admin_approve_user" ||
          (n.type === "language_request_decided" && n.data.approved)
            ? "success"
            : "info",
        icon: d.icon,
        title: d.title,
        description: d.body,
        actions: [{ label: t("open"), href: d.href }],
        duration: 10000,
      });
      router.refresh();
    });
  }, [userId, router, toast, t, locale]);

  return null;
}
