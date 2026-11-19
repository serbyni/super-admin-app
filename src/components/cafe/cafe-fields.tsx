"use client";

import { useState } from "react";
import { PhoneField } from "@/components/auth/phone-field";
import { SelectField, TextField } from "@/components/auth/fields";
import {
  CAFE_LOCALES,
  CURRENCY_BY_COUNTRY,
  FALLBACK_CURRENCY,
  FALLBACK_TIMEZONE,
  TIMEZONE_BY_COUNTRY,
} from "@/config/cafe-defaults";
import type { CafeFieldOptions } from "@/config/cafe-options";
import { socialHandle } from "@/lib/cafes/contact";

/*
 * Café form fields shared by the onboarding wizard and the café settings, so both always ask
 * for the same things with the same rules (validated by the same zod schemas on the server).
 */

type Errors = Record<string, string | undefined>;

export type CafeDetailsValues = {
  name?: string;
  country_code?: string;
  city?: string;
  address?: string;
  currency?: string;
  timezone?: string;
  locale?: string;
};

/** Name, country, city, street address, currency, time zone, default menu language. */
export function CafeDetailsFields({
  values,
  errors,
  options,
}: {
  values: CafeDetailsValues;
  errors: Errors;
  /** Built on the server (cafeFieldOptions) so labels match after hydration. */
  options: CafeFieldOptions;
}) {
  const draft = values;
  const [country, setCountry] = useState(draft.country_code ?? "");
  // Country change → suggest its currency + time zone (re-mounts those selects).
  const currency = country === draft.country_code ? draft.currency : CURRENCY_BY_COUNTRY[country];
  const timezone = country === draft.country_code ? draft.timezone : TIMEZONE_BY_COUNTRY[country];
  return (
    <div className="flex flex-col gap-md">
      <TextField
        id="name"
        label="Café name"
        icon="storefront"
        required
        defaultValue={draft.name}
        error={errors.name}
      />
      <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
        <SelectField
          id="country_code"
          label="Country"
          icon="public"
          placeholder="Select country"
          options={options.countries}
          required
          defaultValue={draft.country_code}
          onChange={(e) => setCountry(e.target.value)}
          error={errors.country_code}
        />
        <TextField
          id="city"
          label="City"
          icon="location_city"
          required
          defaultValue={draft.city}
          error={errors.city}
        />
      </div>
      <TextField
        id="address"
        label="Address"
        icon="signpost"
        defaultValue={draft.address}
        error={errors.address}
      />
      <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
        <SelectField
          key={`cur-${country}`}
          id="currency"
          label="Currency"
          icon="payments"
          placeholder="Select currency"
          options={options.currencies}
          required
          defaultValue={currency ?? FALLBACK_CURRENCY}
          error={errors.currency}
        />
        <SelectField
          key={`tz-${country}`}
          id="timezone"
          label="Time zone"
          icon="schedule"
          placeholder="Select time zone"
          options={options.timezones}
          required
          defaultValue={timezone ?? FALLBACK_TIMEZONE}
          error={errors.timezone}
        />
      </div>
      <fieldset>
        <legend className="mb-xs text-body-sm font-semibold text-on-surface">
          Default menu language
        </legend>
        <div className="flex flex-wrap gap-sm">
          {CAFE_LOCALES.map((l) => (
            <label
              key={l.value}
              className="flex cursor-pointer items-center gap-xs rounded-lg border border-outline-variant px-md py-sm has-checked:border-primary has-checked:bg-secondary-container"
            >
              <input
                type="radio"
                name="locale"
                value={l.value}
                defaultChecked={(draft.locale ?? "en") === l.value}
                className="accent-primary"
              />
              <span className="text-body-sm font-semibold text-on-surface">{l.label}</span>
            </label>
          ))}
        </div>
        {errors.locale ? <p className="mt-1 text-body-xs text-error">{errors.locale}</p> : null}
      </fieldset>
    </div>
  );
}

export type CafeContactValues = {
  phone?: string;
  email?: string;
  facebook?: string;
  instagram?: string;
  /** Suggests the phone country while the number is empty. */
  country_code?: string;
};

/** Café phone + email (required), Facebook page and Instagram (optional). */
export function CafeContactFields({
  values,
  errors,
}: {
  values: CafeContactValues;
  errors: Errors;
}) {
  const draft = values;
  return (
    <div className="flex flex-col gap-md">
      <PhoneField
        id="phone"
        label="Café phone"
        required
        defaultValue={draft.phone}
        suggestedCountry={draft.country_code}
        error={errors.phone}
      />
      <TextField
        id="email"
        type="email"
        label="Café email"
        icon="mail"
        required
        autoComplete="email"
        defaultValue={draft.email}
        error={errors.email}
      />
      <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
        <TextField
          id="facebook"
          label="Facebook page (optional)"
          icon="thumb_up"
          placeholder="facebook.com/yourcafe"
          autoCapitalize="none"
          spellCheck={false}
          defaultValue={socialHandle(draft.facebook)}
          error={errors.facebook}
        />
        <TextField
          id="instagram"
          label="Instagram (optional)"
          icon="photo_camera"
          placeholder="@yourcafe"
          autoCapitalize="none"
          spellCheck={false}
          defaultValue={socialHandle(draft.instagram)}
          error={errors.instagram}
        />
      </div>
    </div>
  );
}
