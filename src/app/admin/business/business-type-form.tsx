"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FieldError, FieldLabel } from "@/components/auth/fields";
import { FormAlert } from "@/components/auth/form-alert";
import { SubmitButton } from "@/components/auth/submit-button";
import { Icon } from "@/components/ui/icon";
import type { AdminBusinessType } from "@/lib/business-types/schema";
import { saveBusinessType, type BusinessTypeFormState } from "./actions";

const input =
  "w-full rounded-lg bg-surface-container-low px-4 py-3 text-body-md text-on-surface transition-all placeholder:text-outline focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary-container focus:outline-none";

function Field({
  id,
  label,
  error,
  hint,
  required,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  error?: string;
  hint?: string;
}) {
  return (
    <div>
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      <input
        id={id}
        name={id}
        required={required}
        aria-invalid={error ? true : undefined}
        className={`${input} ${error ? "ring-2 ring-error" : ""}`}
        {...rest}
      />
      {hint && !error ? <p className="mt-1 text-caption text-on-surface-variant">{hint}</p> : null}
      <FieldError id={id} message={error} />
    </div>
  );
}

export function BusinessTypeForm({ type }: { type?: AdminBusinessType }) {
  const [state, action] = useActionState<BusinessTypeFormState, FormData>(saveBusinessType, {});
  const e = state.errors ?? {};
  const v = state.values;
  const val = (key: string, fallback: string | number | undefined) => v?.[key] ?? fallback ?? "";
  const activeDefault = v ? v.is_active === "on" : (type?.is_active ?? true);
  const icon = String(val("icon", type?.icon ?? "storefront"));

  return (
    <form
      action={action}
      noValidate
      className="flex max-w-2xl flex-col gap-md rounded-xl bg-surface-container-lowest p-lg shadow-sm"
    >
      <FormAlert message={e.form} />
      <input type="hidden" name="id" value={type?.id ?? ""} />
      <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
        <Field
          id="slug"
          label="Code"
          required
          defaultValue={val("slug", type?.slug)}
          placeholder="food_truck"
          hint="Stable identifier, lowercase (a–z, 0–9, _)."
          error={e.slug}
        />
        <div>
          <Field
            id="icon"
            label="Icon"
            required
            defaultValue={icon}
            placeholder="local_cafe"
            hint="Material Symbols name."
            error={e.icon}
          />
        </div>
      </div>
      <div className="flex items-center gap-sm rounded-lg bg-surface-container-low p-sm">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary-container text-primary">
          <Icon name={icon} className="text-icon-lg" />
        </span>
        <span className="text-body-sm text-on-surface-variant">Icon preview (saved value)</span>
      </div>
      <Field
        id="name_en"
        label="Name (English)"
        required
        defaultValue={val("name_en", type?.name.en)}
        placeholder="Food truck"
        error={e.name_en}
      />
      <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
        <Field
          id="name_fr"
          label="Name (French)"
          defaultValue={val("name_fr", type?.name.fr)}
          placeholder="Food truck"
          error={e.name_fr}
        />
        <Field
          id="name_ar"
          label="Name (Arabic)"
          dir="rtl"
          defaultValue={val("name_ar", type?.name.ar)}
          placeholder="شاحنة طعام"
          error={e.name_ar}
        />
      </div>
      <div className="grid grid-cols-1 items-end gap-md sm:grid-cols-2">
        <Field
          id="sort_order"
          label="Order"
          type="number"
          min={0}
          step={1}
          required
          defaultValue={val("sort_order", type?.sort_order ?? 50)}
          hint="Lower numbers appear first."
          error={e.sort_order}
        />
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
      </div>
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
