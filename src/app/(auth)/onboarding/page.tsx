import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { applyOwnerLocale } from "@/i18n/owner-locale";
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

// Static title: these pages are prerendered (the visible texts follow the language).
export const metadata: Metadata = { title: "Set up your café" };

const NEXT_STEPS = [
  { icon: "restaurant_menu", key: "menu" },
  { icon: "table_restaurant", key: "tables" },
  { icon: "group", key: "staff" },
] as const;

async function Done({ slug, rootDomain }: { slug: string; rootDomain: string }) {
  const t = await getTranslations("onboarding");
  return (
    <div className="mx-auto w-full max-w-card-md rounded-xl bg-surface-container-lowest p-lg text-center shadow-card-warm sm:p-xl">
      <span className="mx-auto mb-md flex h-16 w-16 items-center justify-center rounded-full bg-success-container text-success">
        <Icon name="celebration" className="text-icon-2xl" />
      </span>
      <h1 className="text-headline-md text-primary">{t("readyTitle")}</h1>
      <p className="mt-xs text-on-surface-variant">
        {t.rich("readyBody", {
          host: cafeHost(slug, rootDomain),
          b: (c) => <strong className="text-on-surface">{c}</strong>,
        })}
      </p>
      <Link
        href={tenantDashboard(slug)}
        className="mt-lg inline-flex w-full items-center justify-center gap-xs rounded-xl bg-primary px-lg py-md font-semibold text-on-primary shadow-button-warm hover:bg-primary-container"
      >
        {t("openDashboard")}
        <Icon name="arrow_forward" className="text-icon-lg" flipRtl />
      </Link>
      <CafePageLink slug={slug} className="mt-sm w-full">
        {t("viewCafe")}
      </CafePageLink>
      <ol className="mt-lg flex flex-col gap-sm text-start">
        {NEXT_STEPS.map((s) => {
          const [title, body] = t(`next.${s.key}`).split("|");
          return (
            <li
              key={s.key}
              className="flex items-start gap-sm rounded-lg bg-surface-container-low p-sm"
            >
              <Icon name={s.icon} className="text-icon-xl text-primary" />
              <span>
                <span className="block font-semibold text-on-surface">{title}</span>
                <span className="block text-body-sm text-on-surface-variant">{body}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

async function Onboarding() {
  // Approved/onboarding owners see the wizard; an active owner sees "Done" (or finishes onboarding).
  const { user, status, cafeSlug } = await requireOwnerStage(["approved", "onboarding", "active"]);
  const locale = await applyOwnerLocale();
  const t = await getTranslations("onboarding");
  const rootDomain = cafeRootDomain();
  if (status === "active" && cafeSlug) return <Done slug={cafeSlug} rootDomain={rootDomain} />;

  const state = await serverApi().onboarding.state();
  return (
    <div className="flex w-full flex-col items-center">
      <OnboardingWizard
        options={cafeFieldOptions(locale)}
        initial={state}
        rootDomain={rootDomain}
        termsVersion={TERMS_VERSION}
        dpaVersion={DPA_VERSION}
      />
      <div className="mx-auto mt-lg flex w-full max-w-3xl items-center justify-between gap-sm text-body-sm text-on-surface-variant">
        <span className="flex items-center gap-xs">
          <Icon name="account_circle" className="text-icon-md text-tertiary" />
          {t("progressSaved", { email: user.email ?? "" })}
        </span>
        <form action={signOut}>
          <button
            type="submit"
            className="inline-flex items-center gap-xs font-semibold text-primary hover:text-primary-container"
          >
            <Icon name="logout" className="text-icon-md" flipRtl />
            {t("signOut")}
          </button>
        </form>
      </div>
    </div>
  );
}

async function OnboardingPageContent() {
  await applyOwnerLocale();
  const t = await getTranslations("onboarding");
  return (
    <AuthShell>
      <Suspense fallback={null}>
        <LiveNotificationsForUser />
      </Suspense>
      <Suspense fallback={<p className="text-center text-on-surface-variant">{t("loading")}</p>}>
        <Onboarding />
      </Suspense>
    </AuthShell>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <OnboardingPageContent />
    </Suspense>
  );
}
