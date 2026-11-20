import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { applyOwnerLocale } from "@/i18n/owner-locale";
import Link from "next/link";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { StatusCard } from "@/components/auth/status-card";
import { Icon } from "@/components/ui/icon";
import { ResendForm } from "./resend-form";

// Static title: these pages are prerendered (the visible texts follow the language).
export const metadata: Metadata = { title: "Check your email" };

async function SentTo({
  searchParams,
}: {
  searchParams: PageProps<"/register/check-email">["searchParams"];
}) {
  const { email } = await searchParams;
  const address = typeof email === "string" ? email : "";
  const t = await getTranslations("checkEmail");
  return (
    <>
      <p className="text-center text-on-surface-variant">
        {address
          ? t.rich("sentTo", {
              email: address,
              b: (c) => <strong className="text-on-surface">{c}</strong>,
            })
          : t("sentToYou")}
      </p>
      {address ? <ResendForm email={address} /> : null}
    </>
  );
}

async function CheckEmailPageContent({
  searchParams,
}: {
  searchParams: PageProps<"/register/check-email">["searchParams"];
}) {
  await applyOwnerLocale();
  const t = await getTranslations("checkEmail");
  return (
    <AuthShell>
      <StatusCard icon="mark_email_unread" eyebrow={t("eyebrow")} title={t("title")}>
        <Suspense fallback={<p className="text-center text-on-surface-variant">…</p>}>
          <SentTo searchParams={searchParams} />
        </Suspense>
        <div className="flex items-start gap-sm rounded-lg bg-surface-container-low p-md">
          <Icon name="info" className="mt-0.5 shrink-0 text-tertiary" />
          <p className="text-body-sm text-on-surface-variant">{t("noEmail")}</p>
        </div>
        <Link
          href="/login"
          className="inline-flex items-center justify-center gap-2 font-label-sm text-label-sm tracking-wider text-primary uppercase hover:text-primary-container"
        >
          <Icon name="arrow_back" className="text-icon-md" flipRtl />
          {t("back")}
        </Link>
      </StatusCard>
    </AuthShell>
  );
}

export default function CheckEmailPage({ searchParams }: PageProps<"/register/check-email">) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <CheckEmailPageContent searchParams={searchParams} />
    </Suspense>
  );
}
