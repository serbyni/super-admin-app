"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useActionState, useEffect } from "react";
import { TextField } from "@/components/auth/fields";
import { PasswordField } from "@/components/auth/password-field";
import { SubmitButton } from "@/components/auth/submit-button";
import { useToast, type ToastOptions } from "@/components/ui/toast";
import { signIn, type LoginState } from "./actions";

const REGISTER = { label: "Register", href: "/register" };

/** Errors passed in the URL (?error=…) by redirects such as /auth/callback. */
function queryToast(error: string, provider: string | null): ToastOptions | null {
  const name = provider ? provider[0].toUpperCase() + provider.slice(1) : "this";
  switch (error) {
    case "no_account":
      return {
        id: "login-no-account",
        variant: "error",
        title: `No Serbi account for this ${name} account`,
        description:
          "Café owners register with their email first (we need the business details and location). Then you can sign in with Google or Facebook using the same email.",
        actions: [REGISTER],
        duration: null,
      };
    case "link_invalid":
      return {
        id: "login-link",
        variant: "error",
        title: "That link is invalid or has expired",
        description: "Sign in, or request a new link.",
      };
    default:
      return null;
  }
}

export function LoginForm() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const [state, action] = useActionState<LoginState, FormData>(signIn, {});

  // Errors from redirects: show once, then drop them from the URL.
  useEffect(() => {
    const error = params.get("error");
    if (!error) return;
    const t = queryToast(error, params.get("provider"));
    if (t) toast.show(t);
    const rest = new URLSearchParams(params);
    rest.delete("error");
    rest.delete("provider");
    router.replace(rest.size ? `${pathname}?${rest}` : pathname, { scroll: false });
  }, [params, pathname, router, toast]);

  // Sign-in errors.
  useEffect(() => {
    if (!state.error) return;
    toast.show({
      id: "login-error",
      variant: "error",
      title: state.error,
      description:
        state.code === "invalid_credentials"
          ? "New to Serbi? Create your café account first."
          : undefined,
      actions:
        state.code === "invalid_credentials"
          ? [{ ...REGISTER, label: "Create an account" }]
          : undefined,
    });
  }, [state, toast]);

  return (
    <form action={action} noValidate className="space-y-4">
      <input type="hidden" name="next" value={params.get("next") ?? ""} />
      <TextField
        id="email"
        label="Email address"
        icon="mail"
        type="email"
        autoComplete="email"
        placeholder="owner@yourcafe.com"
        required
        defaultValue={state.email}
      />
      <PasswordField
        id="password"
        label="Password"
        autoComplete="current-password"
        placeholder="••••••••••"
        required
      />
      <div className="flex flex-col justify-between gap-2 pt-1 sm:flex-row sm:items-center">
        <span className="text-body-sm text-on-surface-variant">
          You stay signed in on this device.
        </span>
        <Link
          href="/forgot-password"
          className="self-start font-label-sm text-label-sm tracking-wide text-primary transition-colors hover:text-primary-container sm:self-auto"
        >
          Forgot password?
        </Link>
      </div>
      <SubmitButton icon="login" pendingLabel="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}
