import { SelectField, TextField } from "./fields";
import type { FieldErrors } from "@/lib/auth/register-schema";
import { localizedName, type BusinessType } from "@/lib/business-types/schema";

type Props = {
  businessTypes: BusinessType[];
  errors?: FieldErrors;
  values?: Record<string, string>;
  withEmail?: boolean;
};

/** Owner + business details, shared by email sign-up and the social "complete profile" step. */
export function BusinessFields({
  businessTypes,
  errors = {},
  values = {},
  withEmail = false,
}: Props) {
  const options = businessTypes.map((t) => ({ value: t.slug, label: localizedName(t.name) }));
  return (
    <>
      <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
        <TextField
          id="fullName"
          label="Full name"
          icon="person"
          autoComplete="name"
          placeholder="e.g. Amira Ben Salah"
          required
          defaultValue={values.fullName}
          error={errors.fullName}
        />
        <TextField
          id="phone"
          label="Phone"
          icon="call"
          type="tel"
          autoComplete="tel"
          placeholder="+216 20 000 000"
          required
          defaultValue={values.phone}
          error={errors.phone}
        />
      </div>
      {withEmail ? (
        <TextField
          id="email"
          label="Email address"
          icon="mail"
          type="email"
          autoComplete="email"
          placeholder="owner@yourcafe.com"
          required
          defaultValue={values.email}
          error={errors.email}
        />
      ) : null}
      <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
        <TextField
          id="businessName"
          label="Business name"
          icon="storefront"
          autoComplete="organization"
          placeholder="e.g. Artisan Brew"
          required
          defaultValue={values.businessName}
          error={errors.businessName}
        />
        <SelectField
          key={values.businessType ?? ""}
          id="businessType"
          label="Business type"
          icon="restaurant"
          placeholder="Select type"
          options={options}
          required
          defaultValue={values.businessType}
          error={errors.businessType}
        />
      </div>
    </>
  );
}
