"use client";

import { useActionState } from "react";
import { BusinessFields } from "@/components/auth/business-fields";
import { FormAlert } from "@/components/auth/form-alert";
import { SubmitButton } from "@/components/auth/submit-button";
import { TermsCheckbox } from "@/components/auth/terms-checkbox";
import { completeOwnerProfile, type FormState } from "../actions";

export function CompleteProfileForm({ defaults }: { defaults: Record<string, string> }) {
  const [state, action] = useActionState<FormState, FormData>(completeOwnerProfile, {});
  const errors = state.errors ?? {};
  return (
    <form action={action} noValidate className="flex flex-col gap-md">
      <FormAlert message={errors.form} />
      <BusinessFields errors={errors} values={state.values ?? defaults} />
      <TermsCheckbox error={errors.terms} />
      <SubmitButton icon="send" pendingLabel="Submitting…">
        Submit application
      </SubmitButton>
    </form>
  );
}
