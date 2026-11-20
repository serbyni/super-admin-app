"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useMsg } from "@/i18n/use-msg";
import { FormAlert } from "@/components/auth/form-alert";
import { BrandColourPicker } from "@/components/cafe/brand-colour-picker";
import {
  CafeContactFields,
  CafeDetailsFields,
  type CafeContactValues,
  type CafeDetailsValues,
} from "@/components/cafe/cafe-fields";
import { MenuPreview } from "@/components/cafe/menu-preview";
import { SaveButton, Section, useSettingsForm, type Action } from "@/components/settings/form-kit";
import type { CafeFieldOptions } from "@/config/cafe-options";

/* ── Café tab ─────────────────────────────────────────────────────────────── */

export function CafeSettingsForm({
  action,
  values,
  host,
  options,
}: {
  action: Action;
  options: CafeFieldOptions;
  values: CafeDetailsValues & CafeContactValues & { seed: string };
  host: string;
}) {
  const t = useTranslations("settings");
  const m = useMsg();
  const { pending, onSubmit, formRef, errors } = useSettingsForm(action);
  const [seed, setSeed] = useState(values.seed);
  return (
    <form ref={formRef} noValidate onSubmit={onSubmit} className="flex flex-col gap-lg">
      <FormAlert message={errors.form} />
      <Section title={t("detailsTitle")} icon="storefront" description={t("detailsBody")}>
        <CafeDetailsFields values={values} errors={errors} options={options} />
      </Section>
      <Section title={t("contactTitle")} icon="call" description={t("contactBody")}>
        <CafeContactFields values={values} errors={errors} />
      </Section>
      <Section title={t("colourTitle")} icon="palette" description={t("colourBody")}>
        <div className="grid grid-cols-1 gap-lg md:grid-cols-2">
          <BrandColourPicker name="seed" value={seed} onChange={setSeed} />
          <MenuPreview
            name={values.name ?? t("yourCafe")}
            host={host}
            seed={seed}
            currency={values.currency ?? "EUR"}
          />
        </div>
        {errors.seed ? <p className="mt-sm text-body-xs text-error">{m(errors.seed)}</p> : null}
      </Section>
      <div className="sticky bottom-0 -mx-gutter flex justify-end bg-background/90 px-gutter pb-md backdrop-blur md:static md:mx-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <SaveButton pending={pending} />
      </div>
    </form>
  );
}
