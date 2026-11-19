import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { StatusCard } from "@/components/auth/status-card";
import { Icon } from "@/components/ui/icon";
import { ResendForm } from "./resend-form";

export const metadata: Metadata = { title: "Check your email" };

async function SentTo({
  searchParams,
}: {
  searchParams: PageProps<"/register/check-email">["searchParams"];
}) {
  const { email } = await searchParams;
  const address = typeof email === "string" ? email : "";
  return (
    <>
      <p className="text-center text-on-surface-variant">
        We sent a verification link to{" "}
        {address ? <strong className="text-on-surface">{address}</strong> : "your email address"}.
        Open it to confirm your email and submit your application.
      </p>
      {address ? <ResendForm email={address} /> : null}
    </>
  );
}

export default function CheckEmailPage({ searchParams }: PageProps<"/register/check-email">) {
  return (
    <AuthShell>
      <StatusCard icon="mark_email_unread" eyebrow="Almost there" title="Check your email">
        <Suspense fallback={<p className="text-center text-on-surface-variant">…</p>}>
          <SentTo searchParams={searchParams} />
        </Suspense>
        <div className="flex items-start gap-sm rounded-lg bg-surface-container-low p-md">
          <Icon name="info" className="mt-0.5 shrink-0 text-tertiary" />
          <p className="text-body-sm text-on-surface-variant">
            No email after a few minutes? Check your spam folder. The link works on any device.
          </p>
        </div>
        <Link
          href="/login"
          className="inline-flex items-center justify-center gap-2 font-label-sm text-label-sm tracking-wider text-primary uppercase hover:text-primary-container"
        >
          <Icon name="arrow_back" className="text-icon-md" flipRtl />
          Back to sign in
        </Link>
      </StatusCard>
    </AuthShell>
  );
}
