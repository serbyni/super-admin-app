import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { RedirectIfSignedIn } from "@/components/auth/redirect-if-signed-in";
import { OrDivider, SocialButtons } from "@/components/auth/social-buttons";
import { Icon } from "@/components/ui/icon";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Login" };

export default function LoginPage() {
  return (
    <AuthShell>
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>
      <div className="mx-auto w-full max-w-card-md">
        <div className="relative overflow-hidden rounded-xl bg-surface-container-lowest/90 shadow-xl shadow-surface-container-highest/60 backdrop-blur-xl">
          <div className="relative h-32 w-full overflow-hidden bg-primary-container sm:h-36">
            <div className="absolute inset-0 bg-cover-glow opacity-60" />
            <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest via-surface-container-lowest/20 to-transparent" />
            <div className="absolute end-6 top-4 flex items-center gap-xs rounded-full bg-surface/80 px-sm py-xs text-secondary backdrop-blur-md">
              <Icon name="translate" className="text-icon-sm" />
              <span className="font-label-sm text-label-sm tracking-wider uppercase">EN</span>
            </div>
          </div>

          <div className="relative px-6 pt-2 pb-10 sm:px-10">
            <span className="mb-2 inline-block rounded bg-secondary-container px-2 py-0.5 font-label-sm text-label-sm tracking-wide text-on-secondary-container uppercase">
              Café owners &amp; Serbi team
            </span>
            <h1 className="text-headline-md tracking-tight text-primary sm:font-display-lg sm:text-display-lg">
              Sign in to Serbi
            </h1>
            <p className="mt-1 text-on-surface-variant">
              Welcome back. Manage your café, menu, tables and orders.
            </p>

            <div className="mt-8">
              <SocialButtons />
            </div>
            <OrDivider label="or sign in with email" />

            <Suspense fallback={null}>
              <LoginForm />
            </Suspense>

            <div className="mt-6 flex items-start gap-3 rounded-lg bg-surface-container-low p-3">
              <Icon name="shield" filled className="mt-0.5 shrink-0 text-icon-lg text-tertiary" />
              <p className="font-label-sm text-label-sm leading-relaxed font-normal text-on-surface-variant">
                <strong className="font-semibold text-on-surface">Restricted access:</strong> café
                owners approved by Serbi and members of the Serbi team. Platform administrators use
                two-step verification.
              </p>
            </div>

            <p className="mt-6 pt-5 text-center text-sm text-on-surface-variant">
              New café on Serbi?
              <Link
                href="/register"
                className="ms-1 font-semibold text-primary hover:text-primary-container hover:underline"
              >
                Create an account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </AuthShell>
  );
}
