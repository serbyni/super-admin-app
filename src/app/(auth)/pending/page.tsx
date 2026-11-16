import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { signOut } from "@/app/auth/actions";
import { AuthShell } from "@/components/auth/auth-shell";
import { StatusCard } from "@/components/auth/status-card";
import { Icon } from "@/components/ui/icon";
import type { OwnerStatus } from "@/lib/auth/owner-status";
import { pathForStatus } from "@/lib/auth/owner-status";
import { getOwnerSession } from "@/lib/auth/session";
import { markAllNotificationsRead } from "@/components/notifications/actions";
import { describeNotification } from "@/components/notifications/notification-list";
import { serverApi } from "@/lib/data/server-api";

export const metadata: Metadata = { title: "Application status" };

const COPY: Partial<
  Record<OwnerStatus, { icon: string; eyebrow: string; title: string; body: string }>
> = {
  pending_approval: {
    icon: "hourglass_top",
    eyebrow: "Application received",
    title: "We're reviewing your application",
    body: "Thanks for joining Serbi. Our team reviews new cafés, usually within 24 hours. We'll email you as soon as you're approved.",
  },
  approved: {
    icon: "verified",
    eyebrow: "Approved",
    title: "You're approved!",
    body: "Your account is approved. Café setup (choosing your subdomain) is coming next.",
  },
  rejected: {
    icon: "block",
    eyebrow: "Application not approved",
    title: "We couldn't approve your application",
    body: "We sent you an email with the reason. Contact us if you think this is a mistake.",
  },
  onboarding: {
    icon: "construction",
    eyebrow: "Setup in progress",
    title: "Finish setting up your café",
    body: "Café setup is coming next.",
  },
  active: {
    icon: "storefront",
    eyebrow: "Active",
    title: "Your café is live",
    body: "Your café dashboard opens on your own subdomain.",
  },
  suspended: {
    icon: "pause_circle",
    eyebrow: "Suspended",
    title: "Your account is suspended",
    body: "Please contact the Serbi team.",
  },
};

async function Status() {
  const { user, status } = await getOwnerSession();
  if (!user) redirect("/login");
  if (status === null || status === "profile_incomplete" || status === "email_unverified") {
    redirect(pathForStatus(status));
  }
  const c = COPY[status]!;
  // In-app notifications (e.g. "You're approved!") until the owner dismisses them.
  const unread = (await serverApi().notifications.list(5)).filter((n) => !n.readAt);
  return (
    <StatusCard icon={c.icon} eyebrow={c.eyebrow} title={c.title}>
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
            <input type="hidden" name="back" value="/pending" />
            <button
              type="submit"
              className="rounded-lg px-sm py-xs text-body-sm font-semibold text-success hover:bg-surface-container-lowest"
            >
              Got it
            </button>
          </form>
        </div>
      ) : null}
      <p className="text-center text-on-surface-variant">{c.body}</p>
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

export default function PendingPage() {
  return (
    <AuthShell>
      <Suspense fallback={<p className="text-on-surface-variant">Loading…</p>}>
        <Status />
      </Suspense>
    </AuthShell>
  );
}
