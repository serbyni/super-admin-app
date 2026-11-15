import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { TextField } from "@/components/auth/fields";
import { PasswordField } from "@/components/auth/password-field";
import { OrDivider, SocialButtons } from "@/components/auth/social-buttons";
import { StaticForm } from "@/components/auth/static-form";
import { Icon } from "@/components/ui/icon";

export const metadata: Metadata = { title: "Login" };

export default function LoginPage() {
  return (
    <AuthShell>
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

            <StaticForm className="space-y-4">
              <TextField
                id="email"
                label="Email address"
                icon="mail"
                type="email"
                autoComplete="email"
                placeholder="owner@yourcafe.com"
                required
              />
              <PasswordField
                id="password"
                label="Password"
                autoComplete="current-password"
                placeholder="••••••••••"
                required
              />
              <div className="flex flex-col justify-between gap-2 pt-1 sm:flex-row sm:items-center">
                <label className="group flex cursor-pointer items-center gap-2 select-none">
                  <input
                    type="checkbox"
                    name="remember"
                    className="h-4 w-4 cursor-pointer rounded accent-primary-container"
                  />
                  <span className="text-sm text-on-surface-variant transition-colors group-hover:text-on-surface">
                    Remember this device for 30 days
                  </span>
                </label>
                <Link
                  href="/forgot-password"
                  className="self-start font-label-sm text-label-sm tracking-wide text-primary transition-colors hover:text-primary-container sm:self-auto"
                >
                  Forgot password?
                </Link>
              </div>
              <button
                type="submit"
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3.5 font-semibold tracking-wide text-on-primary shadow-md transition-all duration-200 hover:scale-101 hover:bg-primary-container hover:shadow-lg active:scale-99"
              >
                <span>Sign in</span>
                <Icon name="arrow_forward" className="text-icon-md" flipRtl />
              </button>
            </StaticForm>

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
