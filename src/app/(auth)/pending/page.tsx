import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { applyOwnerLocale } from "@/i18n/owner-locale";
import { Suspense } from "react";
import { signOut } from "@/app/auth/actions";
import { AuthShell } from "@/components/auth/auth-shell";
import { StatusCard } from "@/components/auth/status-card";
import { Icon } from "@/components/ui/icon";
import type { OwnerStatus } from "@/lib/auth/owner-status";
import { requireOwnerStage } from "@/lib/auth/guards";
import { markAllNotificationsRead } from "@/components/notifications/actions";
import { describeNotification } from "@/components/notifications/notification-list";
import { LiveNotificationsForUser } from "@/components/notifications/live-notifications-for-user";
import { serverApi } from "@/lib/data/server-api";

// Static title: these pages are prerendered (the visible texts follow the language).
export const metadata: Metadata = { title: "Application status" };

type Shown = Exclude<OwnerStatus, "profile_incomplete" | "email_unverified">;
const ICON: Record<Shown, string> = {
  pending_approval: "hourglass_top",
  approved: "verified",
  rejected: "block",
  onboarding: "construction",
  active: "storefront",
  suspended: "pause_circle",
};

async function Status() {
  const { user, status } = await requireOwnerStage(["pending_approval", "rejected", "suspended"]);
  const locale = await applyOwnerLocale();
  const [t, tn] = await Promise.all([getTranslations("pending"), getTranslations("notifications")]);
  const st = status as Shown;
  // In-app notifications (e.g. "You're approved!") until the owner dismisses them.
  const unread = (await serverApi().notifications.list(5)).filter((n) => !n.readAt);
  return (
    <StatusCard icon={ICON[st]} eyebrow={t(`${st}.eyebrow`)} title={t(`${st}.title`)}>
      {unread.length > 0 ? (
        <div role="status" className="flex flex-col gap-sm rounded-lg bg-success-container p-md">
          {unread.map((n) => {
            const d = describeNotification(n, tn, locale);
            return (
              <div key={n.id} className="flex items-start gap-sm">
                <Icon name={d.icon} filled className="text-icon-xl text-success" />
                <div>
                  <p className="font-semibold text-on-surface">{d.title}</p>
                  <p className="text-body-sm text-on-surface-variant">{d.body}</p>
                </div>
              </div>
            );
          })}
          <form action={markAllNotificationsRead} className="flex justify-end">
            <input type="hidden" name="back" value="/pending" />
            <button
              type="submit"
              className="rounded-lg px-sm py-xs text-body-sm font-semibold text-success hover:bg-surface-container-lowest"
            >
              {t("gotIt")}
            </button>
          </form>
        </div>
      ) : null}
      <p className="text-center text-on-surface-variant">{t(`${st}.body`)}</p>
      <div className="flex items-center justify-center gap-sm rounded-lg bg-surface-container-low p-sm text-body-sm text-on-surface-variant">
        <Icon name="account_circle" className="text-icon-md text-tertiary" />
        {user.email}
      </div>
      <form action={signOut} className="flex justify-center">
        <button
          type="submit"
          className="inline-flex items-center gap-xs font-label-sm text-label-sm tracking-wider text-primary uppercase hover:text-primary-container"
        >
          <Icon name="logout" className="text-icon-md" flipRtl />
          {t("signOut")}
        </button>
      </form>
    </StatusCard>
  );
}

async function PendingPageContent() {
  await applyOwnerLocale();
  const t = await getTranslations("pending");
  return (
    <AuthShell>
      <Suspense fallback={null}>
        <LiveNotificationsForUser />
      </Suspense>
      <Suspense fallback={<p className="text-on-surface-variant">{t("loading")}</p>}>
        <Status />
      </Suspense>
    </AuthShell>
  );
}

export default function PendingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <PendingPageContent />
    </Suspense>
  );
}
