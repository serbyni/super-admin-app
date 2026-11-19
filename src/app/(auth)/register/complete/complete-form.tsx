"use client";

import { useActionState, useState } from "react";
import { BusinessFields } from "@/components/auth/business-fields";
import { FormAlert } from "@/components/auth/form-alert";
import { SubmitButton } from "@/components/auth/submit-button";
import { TermsCheckbox } from "@/components/auth/terms-checkbox";
import { LocationPicker, type MapsClientConfig } from "@/components/location/location-picker";
import { initialLocation } from "@/lib/location/initial";
import type { BusinessType } from "@/lib/business-types/schema";
import { completeOwnerProfile, type FormState } from "../actions";

export function CompleteProfileForm({
  defaults,
  businessTypes,
  maps,
}: {
  defaults: Record<string, string>;
  businessTypes: BusinessType[];
  maps: MapsClientConfig;
}) {
  const [state, action] = useActionState<FormState, FormData>(completeOwnerProfile, {});
  const [locationCountry, setLocationCountry] = useState<string | undefined>();
  const errors = state.errors ?? {};
  return (
    <form action={action} noValidate className="flex flex-col gap-md">
      <FormAlert message={errors.form} />
      <BusinessFields
        phoneCountryHint={locationCountry}
        businessTypes={businessTypes}
        errors={errors}
        values={state.values ?? defaults}
      />
      <LocationPicker
        onCountryChange={setLocationCountry}
        maps={maps}
        key={state.values?.location ?? ""}
        initial={initialLocation(state.values)}
        errors={errors}
      />
      <TermsCheckbox error={errors.terms} />
      <SubmitButton icon="send" pendingLabel="Submitting…">
        Submit application
      </SubmitButton>
    </form>
  );
}
