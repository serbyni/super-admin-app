import type { Metadata } from "next";
import { Suspense } from "react";
import { signOut } from "@/app/auth/actions";
import { AuthShell } from "@/components/auth/auth-shell";
import { StatusCard } from "@/components/auth/status-card";
import { markAllNotificationsRead } from "@/components/notifications/actions";
import { describeNotification } from "@/components/notifications/notification-list";
import { Icon } from "@/components/ui/icon";
import { requireOwnerStage } from "@/lib/auth/guards";
import { LiveNotificationsForUser } from "@/components/notifications/live-notifications-for-user";
import { serverApi } from "@/lib/data/server-api";

export const metadata: Metadata = { title: "Set up your café" };

const STEPS = [
  {
    icon: "language",
    title: "Choose your café address",
    body: "The web address your customers use, e.g. yourcafe.serbi.me.",
  },
  {
    icon: "restaurant_menu",
    title: "Build your QR menu",
    body: "Categories, items, prices and photos.",
  },
  {
    icon: "table_restaurant",
    title: "Set up tables & QR codes",
    body: "One QR code per table or zone.",
  },
];

async function Onboarding() {
  // Approved owners, and active owners who have not chosen their café address yet.
  const { user } = await requireOwnerStage(["approved", "onboarding", "active"]);
  const unread = (await serverApi().notifications.list(5)).filter((n) => !n.readAt);
  return (
    <StatusCard icon="verified" eyebrow="Approved" title="Set up your café">
      {unread.length > 0 ? (
        <div role="status" className="flex flex-col gap-sm rounded-lg bg-success-container p-md">
          {unread.map((n) => {
            const d = describeNotification(n);
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
            <input type="hidden" name="back" value="/onboarding" />
            <button
              type="submit"
              className="rounded-lg px-sm py-xs text-body-sm font-semibold text-success hover:bg-surface-container-lowest"
            >
              Got it
            </button>
          </form>
        </div>
      ) : null}
      <p className="text-center text-on-surface-variant">
        Your account is approved. Café setup opens here soon — these are the next steps.
      </p>
      <ol className="flex flex-col gap-sm">
        {STEPS.map((s, i) => (
          <li
            key={s.title}
            className="flex items-start gap-sm rounded-lg bg-surface-container-low p-sm"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary-container font-semibold text-primary">
              {i + 1}
            </span>
            <span>
              <span className="block font-semibold text-on-surface">{s.title}</span>
              <span className="block text-body-sm text-on-surface-variant">{s.body}</span>
            </span>
          </li>
        ))}
      </ol>
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
          Sign out
        </button>
      </form>
    </StatusCard>
  );
}

export default function OnboardingPage() {
  return (
    <AuthShell>
      <Suspense fallback={null}>
        <LiveNotificationsForUser />
      </Suspense>
      <Suspense fallback={<p className="text-on-surface-variant">Loading…</p>}>
        <Onboarding />
      </Suspense>
    </AuthShell>
  );
}
