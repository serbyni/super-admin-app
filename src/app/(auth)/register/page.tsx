import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { SelectField, TextField } from "@/components/auth/fields";
import { PasswordField } from "@/components/auth/password-field";
import { OrDivider, SocialButtons } from "@/components/auth/social-buttons";
import { StaticForm } from "@/components/auth/static-form";
import { Icon } from "@/components/ui/icon";

export const metadata: Metadata = { title: "Register" };

const businessTypes = [
  { value: "cafe", label: "Café / coffee shop" },
  { value: "restaurant", label: "Restaurant" },
  { value: "bakery", label: "Bakery" },
  { value: "other", label: "Other" },
];

const steps = [
  "Create your account and verify your email",
  "The Serbi team reviews your application",
  "Choose your subdomain — your café is live",
];

export default function RegisterPage() {
  return (
    <AuthShell>
      <div className="relative mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-lg lg:grid-cols-12">
        {/* Brand panel */}
        <aside className="relative hidden flex-col justify-between self-stretch overflow-hidden rounded-xl bg-surface-container-low p-xl shadow-sm lg:col-span-5 lg:flex">
          <div className="pointer-events-none absolute -top-24 -left-24 h-80 w-80 rounded-full bg-primary-fixed-dim/20 blur-3xl" />
          <div className="pointer-events-none absolute right-0 bottom-0 h-64 w-64 rounded-full bg-secondary-fixed/40 blur-2xl" />

          <div className="relative z-10">
            <span className="rounded-full bg-surface-container px-sm py-xs font-label-sm text-label-sm tracking-wider text-secondary uppercase">
              For café owners
            </span>
            <p className="mt-lg text-headline-md leading-snug font-bold text-primary">
              Your café, your menu, your QR codes — live in minutes.
            </p>
          </div>

          <div className="relative z-10 my-lg rounded-xl bg-primary-container p-lg text-on-primary-container shadow-md">
            <Icon name="qr_code_2" className="text-[48px]" />
            <p className="mt-sm font-label-sm text-label-sm tracking-wider text-primary-fixed-dim uppercase">
              artisan-brew.serbi.me
            </p>
            <p className="mt-xs font-semibold text-white">
              Branded menu, table ordering and live order tracking.
            </p>
          </div>

          <ol className="relative z-10 flex flex-col gap-sm rounded-lg bg-surface-container-lowest/60 p-md backdrop-blur-sm">
            {steps.map((s, i) => (
              <li key={s} className="flex items-center gap-sm text-[13px] text-on-surface-variant">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[12px] font-bold text-on-primary">
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
              <Icon name="storefront" className="text-[14px]" />
              New café
            </span>
            <h1 className="text-headline-md tracking-tight text-on-surface sm:font-display-lg sm:text-display-lg">
              Create your Serbi account
            </h1>
            <p className="mt-xs text-on-surface-variant">
              After verifying your email, the Serbi team reviews your application — usually within
              24 hours.
            </p>
          </div>

          <SocialButtons verb="Sign up" layout="grid" />
          <OrDivider label="or register with email" />

          <StaticForm className="flex flex-col gap-md">
            <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
              <TextField
                id="fullName"
                label="Full name"
                icon="person"
                autoComplete="name"
                placeholder="e.g. Amira Ben Salah"
                required
              />
              <TextField
                id="phone"
                label="Phone"
                icon="call"
                type="tel"
                autoComplete="tel"
                placeholder="+216 20 000 000"
                required
              />
            </div>
            <TextField
              id="email"
              label="Email address"
              icon="mail"
              type="email"
              autoComplete="email"
              placeholder="owner@yourcafe.com"
              required
            />
            <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
              <TextField
                id="businessName"
                label="Business name"
                icon="storefront"
                autoComplete="organization"
                placeholder="e.g. Artisan Brew"
                required
              />
              <SelectField
                id="businessType"
                label="Business type"
                icon="restaurant"
                placeholder="Select type"
                options={businessTypes}
                required
              />
            </div>
            <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
              <TextField
                id="country"
                label="Country"
                icon="public"
                autoComplete="country-name"
                placeholder="Tunisia"
                required
              />
              <TextField
                id="city"
                label="City"
                icon="location_on"
                autoComplete="address-level2"
                placeholder="Tunis"
                required
              />
            </div>
            <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
              <PasswordField
                id="password"
                label="Password"
                autoComplete="new-password"
                placeholder="Min. 10 characters"
                required
              />
              <PasswordField
                id="confirmPassword"
                label="Confirm password"
                icon="lock_clock"
                autoComplete="new-password"
                placeholder="Re-enter password"
                required
              />
            </div>

            {/* Password strength (visual only) */}
            <div className="flex flex-col gap-xs rounded-lg bg-surface-container-low p-sm">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-[11px] tracking-wider text-on-surface-variant uppercase">
                  Password strength
                </span>
                <span className="font-label-sm text-[11px] text-secondary">Awaiting input</span>
              </div>
              <div className="grid h-1.5 w-full grid-cols-4 gap-xs">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-full rounded-full bg-surface-container-highest" />
                ))}
              </div>
              <p className="font-label-sm text-[11px] font-normal text-outline">
                Use 10+ characters with upper case, a digit and a symbol.
              </p>
            </div>

            <label className="mt-xs flex cursor-pointer items-start gap-sm">
              <input
                type="checkbox"
                name="terms"
                required
                className="mt-1 h-4 w-4 cursor-pointer rounded accent-primary"
              />
              <span className="text-[13px] leading-relaxed text-on-surface-variant select-none">
                I agree to the{" "}
                <Link href="/terms" className="font-semibold text-primary hover:underline">
                  Terms of Service
                </Link>{" "}
                and the{" "}
                <Link href="/privacy" className="font-semibold text-primary hover:underline">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>

            <button
              type="submit"
              className="mt-sm flex w-full cursor-pointer items-center justify-center gap-sm rounded-xl bg-primary py-md text-[16px] font-bold text-on-primary shadow-md transition-all duration-200 hover:scale-[1.01] hover:bg-primary/90 active:scale-[0.99]"
            >
              <Icon name="how_to_reg" className="text-[20px]" />
              <span>Create account</span>
            </button>
          </StaticForm>

          <div className="mt-lg flex items-center justify-center gap-xs rounded-lg bg-surface-container-low/50 p-sm text-center">
            <span className="text-[14px] text-on-surface-variant">Already have an account?</span>
            <Link
              href="/login"
              className="flex items-center gap-xs text-[14px] font-bold text-primary transition-colors hover:text-primary-container"
            >
              <span>Sign in</span>
              <Icon name="arrow_forward" className="text-[16px]" flipRtl />
            </Link>
          </div>
        </div>
      </div>
    </AuthShell>
  );
}
