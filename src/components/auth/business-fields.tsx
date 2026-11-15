import { SelectField, TextField } from "./fields";
import type { FieldErrors } from "@/lib/auth/register-schema";

const businessTypes = [
  { value: "cafe", label: "Café / coffee shop" },
  { value: "restaurant", label: "Restaurant" },
  { value: "bakery", label: "Bakery" },
  { value: "other", label: "Other" },
];

type Props = { errors?: FieldErrors; values?: Record<string, string>; withEmail?: boolean };

/** Owner + business details, shared by email sign-up and the social "complete profile" step. */
export function BusinessFields({ errors = {}, values = {}, withEmail = false }: Props) {
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
          options={businessTypes}
          required
          defaultValue={values.businessType}
          error={errors.businessType}
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
          defaultValue={values.country}
          error={errors.country}
        />
        <TextField
          id="city"
          label="City"
          icon="location_on"
          autoComplete="address-level2"
          placeholder="Tunis"
          required
          defaultValue={values.city}
          error={errors.city}
        />
      </div>
    </>
  );
}
