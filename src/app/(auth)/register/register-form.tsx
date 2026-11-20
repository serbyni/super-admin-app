"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { BusinessFields } from "@/components/auth/business-fields";
import { FormAlert } from "@/components/auth/form-alert";
import { PasswordField } from "@/components/auth/password-field";
import { PasswordStrengthMeter } from "@/components/auth/password-strength-meter";
import { SubmitButton } from "@/components/auth/submit-button";
import { TermsCheckbox } from "@/components/auth/terms-checkbox";
import { LocationPicker, type MapsClientConfig } from "@/components/location/location-picker";
import { initialLocation } from "@/lib/location/initial";
import type { BusinessType } from "@/lib/business-types/schema";
import { registerOwner, type FormState } from "./actions";

export function RegisterForm({
  businessTypes,
  maps,
}: {
  businessTypes: BusinessType[];
  maps: MapsClientConfig;
}) {
  const [state, action] = useActionState<FormState, FormData>(registerOwner, {});
  const [locationCountry, setLocationCountry] = useState<string | undefined>();
  const [password, setPassword] = useState("");
  const t = useTranslations("register");
  const errors = state.errors ?? {};

  return (
    <form action={action} noValidate className="flex flex-col gap-md">
      <FormAlert message={errors.form} />
      <BusinessFields
        phoneCountryHint={locationCountry}
        businessTypes={businessTypes}
        errors={errors}
        values={state.values}
        withEmail
      />
      <LocationPicker
        onCountryChange={setLocationCountry}
        maps={maps}
        key={state.values?.location ?? ""}
        initial={initialLocation(state.values)}
        errors={errors}
      />
      <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
        <PasswordField
          id="password"
          label={t("password")}
          autoComplete="new-password"
          placeholder={t("minChars")}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />
        <PasswordField
          id="confirmPassword"
          label={t("confirm")}
          icon="lock_clock"
          autoComplete="new-password"
          placeholder={t("reenter")}
          required
          error={errors.confirmPassword}
        />
      </div>
      <PasswordStrengthMeter password={password} />
      <TermsCheckbox error={errors.terms} />
      <SubmitButton icon="how_to_reg" pendingLabel={t("creating")}>
        {t("create")}
      </SubmitButton>
    </form>
  );
}
