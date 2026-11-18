"use client";

import Link from "next/link";
import { useActionState } from "react";
import { TextField } from "@/components/auth/fields";
import { FormAlert } from "@/components/auth/form-alert";
import { SubmitButton } from "@/components/auth/submit-button";
import { IconPicker } from "@/components/admin/icon-picker";
import { Icon } from "@/components/ui/icon";
import { DEFAULT_BUSINESS_ICON } from "@/config/business-icons";
import type { AdminBusinessType } from "@/lib/business-types/schema";
import { saveBusinessType, type BusinessTypeFormState } from "./actions";

export function BusinessTypeForm({ type }: { type?: AdminBusinessType }) {
  const [state, action] = useActionState<BusinessTypeFormState, FormData>(saveBusinessType, {});
  const e = state.errors ?? {};
  const v = state.values;
  const val = (key: string, fallback: string | number | undefined) => v?.[key] ?? fallback ?? "";
  const activeDefault = v ? v.is_active === "on" : (type?.is_active ?? true);
  const icon = String(val("icon", type?.icon ?? DEFAULT_BUSINESS_ICON));

  return (
    <form
      action={action}
      noValidate
      className="flex max-w-2xl flex-col gap-md rounded-xl bg-surface-container-lowest p-lg shadow-sm"
    >
      <FormAlert message={e.form} />
      <input type="hidden" name="id" value={type?.id ?? ""} />
      <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
        <TextField
          id="slug"
          label="Code"
          required
          defaultValue={val("slug", type?.slug)}
          placeholder="food_truck"
          hint="Stable identifier, lowercase (a–z, 0–9, _)."
          error={e.slug}
        />
        <IconPicker name="icon" label="Icon" defaultValue={icon} error={e.icon} />
      </div>
      <TextField
        id="name_en"
        label="Name (English)"
        required
        defaultValue={val("name_en", type?.name.en)}
        placeholder="Food truck"
        error={e.name_en}
      />
      <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
        <TextField
          id="name_fr"
          label="Name (French)"
          defaultValue={val("name_fr", type?.name.fr)}
          placeholder="Food truck"
          error={e.name_fr}
        />
        <TextField
          id="name_ar"
          label="Name (Arabic)"
          dir="rtl"
          defaultValue={val("name_ar", type?.name.ar)}
          placeholder="شاحنة طعام"
          error={e.name_ar}
        />
      </div>
      <label className="flex cursor-pointer items-center gap-sm rounded-lg bg-surface-container-low p-sm">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={activeDefault}
          className="h-5 w-5 cursor-pointer accent-primary"
        />
        <span className="text-body-sm text-on-surface">
          Active — shown to café owners at registration
        </span>
      </label>
      <div className="flex flex-col-reverse gap-sm sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/admin/business"
          className="inline-flex items-center gap-xs text-body-sm font-semibold text-on-surface-variant hover:text-on-surface"
        >
          <Icon name="arrow_back" className="text-icon-md" flipRtl />
          Back to list
        </Link>
        <div className="sm:w-64">
          <SubmitButton icon="save" pendingLabel="Saving…">
            {type ? "Save changes" : "Create business type"}
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}
