"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { TextField } from "@/components/auth/fields";
import { FormAlert } from "@/components/auth/form-alert";
import { PasswordField } from "@/components/auth/password-field";
import { SubmitButton } from "@/components/auth/submit-button";
import { signIn, type LoginState } from "./actions";

const QUERY_ERRORS: Record<string, string> = {
  link_invalid: "That link is invalid or has expired. Sign in or request a new one.",
  not_admin: "This account does not have access to the Serbi admin area.",
};

export function LoginForm() {
  const params = useSearchParams();
  const [state, action] = useActionState<LoginState, FormData>(signIn, {});
  const queryError = QUERY_ERRORS[params.get("error") ?? ""];

  return (
    <form action={action} noValidate className="space-y-4">
      <FormAlert message={state.error ?? queryError} />
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
