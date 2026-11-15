import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { TextField } from "@/components/auth/fields";
import { StaticForm } from "@/components/auth/static-form";
import { Icon } from "@/components/ui/icon";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell>
      <div className="mx-auto w-full max-w-[32rem]">
        <div className="relative flex flex-col rounded-xl bg-surface-container-lowest/90 p-8 shadow-[0_12px_40px_rgba(85,55,34,0.08)] backdrop-blur-xl sm:p-10">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-surface-container text-primary shadow-sm">
              <Icon name="lock_reset" filled className="text-[30px]" />
            </div>
            <span className="inline-flex items-center gap-xs rounded-full bg-surface-container px-3 py-1.5 text-on-surface-variant">
              <Icon name="shield" className="text-[16px] text-tertiary" />
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

          <StaticForm className="space-y-5">
            <TextField
              id="email"
              label="Email address"
              icon="mail"
              type="email"
              autoComplete="email"
              placeholder="owner@yourcafe.com"
              required
            />
            <button
              type="submit"
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3.5 font-semibold tracking-wide text-on-primary shadow-[0_4px_16px_rgba(85,55,34,0.2)] transition-all duration-200 hover:bg-primary-container active:scale-[0.99]"
            >
              <span>Send reset link</span>
              <Icon name="send" className="text-[20px]" flipRtl />
            </button>
            <div className="flex items-center justify-center gap-2 py-1 text-center">
              <Icon name="schedule" className="text-[16px] text-tertiary" />
              <p className="font-label-sm text-label-sm font-normal text-on-surface-variant">
                For security, the link expires after a short time.
              </p>
            </div>
          </StaticForm>

          <div className="mt-8 flex justify-center pt-6">
            <Link
              href="/login"
              className="group inline-flex items-center gap-2 font-label-sm text-label-sm tracking-wider text-primary uppercase transition-colors hover:text-primary-container"
            >
              <Icon
                name="arrow_back"
                className="text-[18px] transition-transform group-hover:-translate-x-1"
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
