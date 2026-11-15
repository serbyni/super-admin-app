import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { Icon } from "@/components/ui/icon";

export const metadata: Metadata = { title: "Password updated" };

export default function ResetPasswordSuccessPage() {
  return (
    <AuthShell>
      <div className="relative mx-auto flex w-full max-w-2xl flex-col items-center">
        <div className="flex w-full flex-col gap-lg rounded-xl bg-surface-container-lowest p-gutter shadow-xl shadow-primary/5 sm:p-lg">
          <div className="mt-xs flex flex-col items-center text-center">
            <div className="relative mb-md flex items-center justify-center">
              <div className="absolute h-24 w-24 animate-ping rounded-full bg-secondary-container/50 opacity-30" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-secondary-container to-surface-container shadow-md">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-container text-surface-container-lowest shadow-sm">
                  <Icon name="verified_user" filled className="text-icon-2xl" />
                </div>
              </div>
              <span className="absolute -end-1 -bottom-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-surface-container-lowest shadow-sm">
                <Icon name="check" className="text-icon-xs" />
              </span>
            </div>
            <h1 className="mb-xs text-headline-md font-bold tracking-tight text-primary">
              Password updated
            </h1>
            <p className="max-w-card-sm text-on-surface-variant">
              Your password has been changed. For your security, you have been signed out of your
              other devices.
            </p>
          </div>

          <div className="flex flex-col gap-sm">
            <Link
              href="/login"
              className="group flex w-full items-center justify-center gap-xs rounded-xl bg-primary px-lg py-md text-center text-body-lg font-semibold text-on-primary shadow-md shadow-primary/20 transition-all duration-200 hover:bg-primary-container active:scale-99"
            >
              <span>Continue to sign in</span>
              <Icon
                name="arrow_forward"
                className="text-icon-lg transition-transform duration-200 group-hover:translate-x-1"
                flipRtl
              />
            </Link>
            <div className="flex flex-col items-center justify-between gap-xs pt-xs sm:flex-row">
              <Link
                href="/"
                className="flex items-center gap-xs rounded-lg px-sm py-xs font-label-sm text-label-sm text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary"
              >
                <Icon name="home" className="text-icon-sm" />
                Back to serbi.me
              </Link>
              <Link
                href="/contact"
                className="flex items-center gap-xs rounded-lg px-sm py-xs font-label-sm text-label-sm text-secondary transition-colors hover:bg-surface-container hover:text-primary"
              >
                <Icon name="help_outline" className="text-icon-sm" />
                Need help? Contact us
              </Link>
            </div>
          </div>

          <div className="flex items-start gap-sm rounded-lg bg-surface-container p-md">
            <Icon name="shield" filled className="mt-0.5 shrink-0 text-primary" />
            <p className="text-on-surface-variant">
              Didn&apos;t change your password? Contact us right away so we can secure your account.
            </p>
          </div>
        </div>
      </div>
    </AuthShell>
  );
}
