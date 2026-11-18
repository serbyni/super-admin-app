"use client";

import { useActionState, useState } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { PasswordField } from "@/components/auth/password-field";
import { PasswordStrengthMeter } from "@/components/auth/password-strength-meter";
import { SubmitButton } from "@/components/auth/submit-button";
import { resetPassword, type ResetState } from "./actions";

export function ResetPasswordForm() {
  const [state, action] = useActionState<ResetState, FormData>(resetPassword, {});
  const [password, setPassword] = useState("");
  const e = state.errors ?? {};
  return (
    <form action={action} noValidate className="flex flex-col gap-md">
      <FormAlert message={e.form} />
      <PasswordField
        id="password"
        label="New password"
        autoComplete="new-password"
        placeholder="Min. 10 characters"
        required
        value={password}
        onChange={(ev) => setPassword(ev.target.value)}
        error={e.password}
      />
      <PasswordField
        id="confirmPassword"
        label="Confirm new password"
        icon="lock_clock"
        autoComplete="new-password"
        placeholder="Re-enter password"
        required
        error={e.confirmPassword}
      />
      <PasswordStrengthMeter password={password} />
      <SubmitButton icon="lock_reset" pendingLabel="Saving…">
        Save new password
      </SubmitButton>
    </form>
  );
}
