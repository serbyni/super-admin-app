import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { RedirectIfSignedIn } from "@/components/auth/redirect-if-signed-in";
import { Icon } from "@/components/ui/icon";
import { ForgotPasswordForm } from "./forgot-form";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell>
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>
      <div className="mx-auto w-full max-w-card-sm">
        <div className="relative flex flex-col rounded-xl bg-surface-container-lowest/90 p-8 shadow-card-warm backdrop-blur-xl sm:p-10">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-surface-container text-primary shadow-sm">
              <Icon name="lock_reset" filled className="text-icon-xl" />
            </div>
            <span className="inline-flex items-center gap-xs rounded-full bg-surface-container px-3 py-1.5 text-on-surface-variant">
              <Icon name="shield" className="text-icon-sm text-tertiary" />
              <span className="font-label-sm text-label-sm tracking-wider uppercase">
                Account recovery
              </span>
            </span>
          </div>

          <div className="mb-8 space-y-sm">
            <h1 className="text-headline-md font-semibold tracking-tight text-on-surface">
              Reset your password
            </h1>
            <p className="leading-relaxed text-on-surface-variant">
              Enter the email you registered with and we will send you a secure link to choose a new
              password.
            </p>
          </div>

          <Suspense fallback={null}>
            <ForgotPasswordForm />
          </Suspense>

          <div className="mt-8 flex justify-center pt-6">
            <Link
              href="/login"
              className="group inline-flex items-center gap-2 font-label-sm text-label-sm tracking-wider text-primary uppercase transition-colors hover:text-primary-container"
            >
              <Icon
                name="arrow_back"
                className="text-icon-md transition-transform group-hover:-translate-x-1"
                flipRtl
              />
              <span>Back to sign in</span>
            </Link>
          </div>
        </div>
      </div>
    </AuthShell>
  );
}
