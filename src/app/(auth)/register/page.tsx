import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { applyOwnerLocale } from "@/i18n/owner-locale";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { RedirectIfSignedIn } from "@/components/auth/redirect-if-signed-in";
import { connection } from "next/server";
import { Suspense } from "react";
import { serverApi } from "@/lib/data/server-api";
import { mapsClientConfig } from "@/lib/maps/server";
import { RegisterForm } from "./register-form";
import { Icon } from "@/components/ui/icon";

// Static title: these pages are prerendered (the visible texts follow the language).
export const metadata: Metadata = { title: "Register" };

/** Business types are managed by super admins; read at request time (cached, tag-invalidated). */
async function RegisterFormWithTypes() {
  await connection();
  return (
    <RegisterForm
      businessTypes={await serverApi().businessTypes.listActive()}
      maps={mapsClientConfig()}
    />
  );
}

async function RegisterPageContent() {
  await applyOwnerLocale();
  const t = await getTranslations("register");
  const steps = t("steps").split("|");
  return (
    <AuthShell>
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>
      <div className="relative mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-lg lg:grid-cols-12">
        {/* Brand panel */}
        <aside className="relative hidden flex-col justify-between self-stretch overflow-hidden rounded-xl bg-surface-container-low p-xl shadow-sm lg:col-span-5 lg:flex">
          <div className="pointer-events-none absolute -top-24 -left-24 h-80 w-80 rounded-full bg-primary-fixed-dim/20 blur-3xl" />
          <div className="pointer-events-none absolute right-0 bottom-0 h-64 w-64 rounded-full bg-secondary-fixed/40 blur-2xl" />

          <div className="relative z-10">
            <span className="rounded-full bg-surface-container px-sm py-xs font-label-sm text-label-sm tracking-wider text-secondary uppercase">
              {t("forOwners")}
            </span>
            <p className="mt-lg text-headline-md leading-snug font-bold text-primary">
              {t("pitch")}
            </p>
          </div>

          <div className="relative z-10 my-lg rounded-xl bg-primary-container p-lg text-on-primary-container shadow-md">
            <Icon name="qr_code_2" className="text-icon-3xl" />
            <p className="mt-sm font-label-sm text-label-sm tracking-wider text-primary-fixed-dim uppercase">
              artisan-brew.serbi.me
            </p>
            <p className="mt-xs font-semibold text-white">{t("pitchBody")}</p>
          </div>

          <ol className="relative z-10 flex flex-col gap-sm rounded-lg bg-surface-container-lowest/60 p-md backdrop-blur-sm">
            {steps.map((s, i) => (
              <li key={s} className="flex items-center gap-sm text-body-xs text-on-surface-variant">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-label-sm font-bold text-on-primary">
                  {i + 1}
                </span>
                {s}
              </li>
            ))}
          </ol>
        </aside>

        {/* Form card */}
        <div className="relative rounded-xl bg-surface-container-lowest p-lg shadow-md sm:p-xl lg:col-span-7">
          <div className="mb-lg">
            <span className="mb-sm inline-flex items-center gap-xs rounded-full bg-secondary-fixed px-sm py-xs font-label-sm text-label-sm tracking-wider text-on-secondary-fixed uppercase">
              <Icon name="storefront" className="text-icon-xs" />
              {t("newCafe")}
            </span>
            <h1 className="text-headline-md tracking-tight text-on-surface sm:font-display-lg sm:text-display-lg">
              {t("title")}
            </h1>
            <p className="mt-xs text-on-surface-variant">{t("subtitle")}</p>
          </div>

          <Suspense fallback={<p className="text-on-surface-variant">{t("loadingForm")}</p>}>
            <RegisterFormWithTypes />
          </Suspense>

          <div className="mt-lg flex items-center justify-center gap-xs rounded-lg bg-surface-container-low/50 p-sm text-center">
            <span className="text-body-sm text-on-surface-variant">{t("haveAccount")}</span>
            <Link
              href="/login"
              className="flex items-center gap-xs text-body-sm font-bold text-primary transition-colors hover:text-primary-container"
            >
              <span>{t("signIn")}</span>
              <Icon name="arrow_forward" className="text-icon-sm" flipRtl />
            </Link>
          </div>
        </div>
      </div>
    </AuthShell>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <RegisterPageContent />
    </Suspense>
  );
}
