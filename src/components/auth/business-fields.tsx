import { useTranslations } from "next-intl";
import { SelectField, TextField } from "./fields";
import { PhoneField } from "./phone-field";
import type { FieldErrors } from "@/lib/auth/register-schema";
import { localizedName, type BusinessType } from "@/lib/business-types/schema";

type Props = {
  businessTypes: BusinessType[];
  errors?: FieldErrors;
  values?: Record<string, string>;
  withEmail?: boolean;
  /** ISO country of the business location; pre-selects the phone country while it is empty. */
  phoneCountryHint?: string;
};

/** Owner + business details, shared by email sign-up and the social "complete profile" step. */
export function BusinessFields({
  businessTypes,
  errors = {},
  values = {},
  withEmail = false,
  phoneCountryHint,
}: Props) {
  const t = useTranslations("register");
  const options = businessTypes.map((t) => ({ value: t.slug, label: localizedName(t.name) }));
  return (
    <>
      <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
        <TextField
          id="fullName"
          label={t("fullName")}
          icon="person"
          autoComplete="name"
          placeholder={t("fullNamePlaceholder")}
          required
          defaultValue={values.fullName}
          error={errors.fullName}
        />
        <PhoneField
          key={values.phone ?? ""}
          id="phone"
          label={t("phone")}
          required
          defaultValue={values.phone}
          error={errors.phone}
          suggestedCountry={phoneCountryHint}
        />
      </div>
      {withEmail ? (
        <TextField
          id="email"
          label={t("email")}
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
          label={t("businessName")}
          icon="storefront"
          autoComplete="organization"
          placeholder={t("businessNamePlaceholder")}
          required
          defaultValue={values.businessName}
          error={errors.businessName}
        />
        <SelectField
          key={values.businessType ?? ""}
          id="businessType"
          label={t("businessType")}
          icon="restaurant"
          placeholder={t("selectType")}
          options={options}
          required
          defaultValue={values.businessType}
          error={errors.businessType}
        />
      </div>
    </>
  );
}
