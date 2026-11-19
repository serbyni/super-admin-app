import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/app/auth/actions";
import { AuthShell } from "@/components/auth/auth-shell";
import { LiveNotificationsForUser } from "@/components/notifications/live-notifications-for-user";
import { Icon } from "@/components/ui/icon";
import { cafeFieldOptions } from "@/config/cafe-options";
import { DPA_VERSION, TERMS_VERSION } from "@/config/legal";
import { requireOwnerStage } from "@/lib/auth/guards";
import { tenantDashboard } from "@/lib/auth/routes";
import { CafePageLink } from "@/components/cafe/cafe-page-link";
import { cafeHost } from "@/lib/cafes/slug";
import { serverApi } from "@/lib/data/server-api";
import { cafeRootDomain } from "@/lib/env";
import { OnboardingWizard } from "./wizard";

export const metadata: Metadata = { title: "Set up your café" };

const NEXT_STEPS = [
  {
    icon: "restaurant_menu",
    title: "Add your menu",
    body: "Categories, drinks and food, prices and photos.",
  },
  {
    icon: "table_restaurant",
    title: "Create tables & print QR codes",
    body: "One QR code per table or zone.",
  },
  { icon: "group", title: "Invite your staff", body: "So your team can receive orders." },
];

function Done({ slug, rootDomain }: { slug: string; rootDomain: string }) {
  return (
    <div className="mx-auto w-full max-w-card-md rounded-xl bg-surface-container-lowest p-lg text-center shadow-card-warm sm:p-xl">
      <span className="mx-auto mb-md flex h-16 w-16 items-center justify-center rounded-full bg-success-container text-success">
        <Icon name="celebration" className="text-icon-2xl" />
      </span>
      <h1 className="text-headline-md text-primary">Your café is ready!</h1>
      <p className="mt-xs text-on-surface-variant">
        It lives at <strong className="text-on-surface">{cafeHost(slug, rootDomain)}</strong>. We
        also sent you an email with the link.
      </p>
      <Link
        href={tenantDashboard(slug)}
        className="mt-lg inline-flex w-full items-center justify-center gap-xs rounded-xl bg-primary px-lg py-md font-semibold text-on-primary shadow-button-warm hover:bg-primary-container"
      >
        Open my dashboard
        <Icon name="arrow_forward" className="text-icon-lg" flipRtl />
      </Link>
      <CafePageLink slug={slug} className="mt-sm w-full">
        View my café page
      </CafePageLink>
      <ol className="mt-lg flex flex-col gap-sm text-start">
        {NEXT_STEPS.map((s) => (
          <li
            key={s.title}
            className="flex items-start gap-sm rounded-lg bg-surface-container-low p-sm"
          >
            <Icon name={s.icon} className="text-icon-xl text-primary" />
            <span>
              <span className="block font-semibold text-on-surface">{s.title}</span>
              <span className="block text-body-sm text-on-surface-variant">{s.body}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

async function Onboarding() {
  // Approved/onboarding owners see the wizard; an active owner sees "Done" (or finishes onboarding).
  const { user, status, cafeSlug } = await requireOwnerStage(["approved", "onboarding", "active"]);
  const rootDomain = cafeRootDomain();
  if (status === "active" && cafeSlug) return <Done slug={cafeSlug} rootDomain={rootDomain} />;

  const state = await serverApi().onboarding.state();
  return (
    <div className="flex w-full flex-col items-center">
      <OnboardingWizard
        options={cafeFieldOptions()}
        initial={state}
        rootDomain={rootDomain}
        termsVersion={TERMS_VERSION}
        dpaVersion={DPA_VERSION}
      />
      <div className="mx-auto mt-lg flex w-full max-w-3xl items-center justify-between gap-sm text-body-sm text-on-surface-variant">
        <span className="flex items-center gap-xs">
          <Icon name="account_circle" className="text-icon-md text-tertiary" />
          {user.email} · progress is saved automatically
        </span>
        <form action={signOut}>
          <button
            type="submit"
            className="inline-flex items-center gap-xs font-semibold text-primary hover:text-primary-container"
          >
            <Icon name="logout" className="text-icon-md" flipRtl />
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <AuthShell>
      <Suspense fallback={null}>
        <LiveNotificationsForUser />
      </Suspense>
      <Suspense fallback={<p className="text-center text-on-surface-variant">Loading…</p>}>
        <Onboarding />
      </Suspense>
    </AuthShell>
  );
}
