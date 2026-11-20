import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { applyOwnerLocale } from "@/i18n/owner-locale";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Icon } from "@/components/ui/icon";
import { serverApi } from "@/lib/data/server-api";
import { ResetPasswordForm } from "./reset-form";

// Static title: these pages are prerendered (the visible texts follow the language).
export const metadata: Metadata = { title: "Choose a new password" };

/** Only reachable with the recovery session opened by the reset email (/auth/reset). */
async function Gate() {
  const user = await serverApi().auth.currentUser();
  if (!user) redirect("/forgot-password?error=link_expired");
  return (
    <>
      <p className="mb-md flex items-center gap-xs rounded-lg bg-surface-container-low p-sm text-body-sm text-on-surface-variant">
        <Icon name="account_circle" className="text-icon-md text-tertiary" />
        {user.email}
      </p>
      <ResetPasswordForm />
    </>
  );
}

async function ResetPasswordPageContent() {
  await applyOwnerLocale();
  const t = await getTranslations("reset");
  return (
    <AuthShell>
      <div className="mx-auto w-full max-w-card-sm">
        <div className="relative flex flex-col rounded-xl bg-surface-container-lowest/90 p-8 shadow-card-warm backdrop-blur-xl sm:p-10">
          <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-xl bg-surface-container text-primary shadow-sm">
            <Icon name="password" filled className="text-icon-xl" />
          </div>
          <div className="mb-lg space-y-sm">
            <h1 className="text-headline-md font-semibold tracking-tight text-on-surface">
              {t("title")}
            </h1>
            <p className="leading-relaxed text-on-surface-variant">{t("body")}</p>
          </div>
          <Suspense fallback={<p className="text-on-surface-variant">{t("loading")}</p>}>
            <Gate />
          </Suspense>
        </div>
      </div>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <ResetPasswordPageContent />
    </Suspense>
  );
}
