"use client";

import { Icon } from "@/components/ui/icon";

/**
 * Grid of icons to choose one (radio group). `noneLabel` adds a first "no icon" choice
 * (value "").
 */
export function IconPicker({
  icons,
  value,
  onChange,
  label,
  noneLabel,
  error,
}: {
  icons: readonly string[];
  value: string;
  onChange: (icon: string) => void;
  label: string;
  noneLabel?: string;
  error?: string;
}) {
  const cell = (on: boolean) =>
    `flex h-10 items-center justify-center rounded-lg border ${
      on
        ? "border-primary bg-secondary-container text-primary"
        : "border-outline-variant text-on-surface-variant hover:bg-surface-container"
    }`;
  return (
    <fieldset>
      <legend className="mb-xs text-body-sm font-semibold text-on-surface">{label}</legend>
      <div className="grid grid-cols-6 gap-xs sm:grid-cols-8" role="radiogroup" aria-label={label}>
        {noneLabel !== undefined ? (
          <button
            type="button"
            role="radio"
            aria-checked={value === ""}
            aria-label={noneLabel}
            title={noneLabel}
            onClick={() => onChange("")}
            className={cell(value === "")}
          >
            <Icon name="block" className="text-icon-md" />
          </button>
        ) : null}
        {icons.map((i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={value === i}
            aria-label={i.replaceAll("_", " ")}
            onClick={() => onChange(i)}
            className={cell(value === i)}
          >
            <Icon name={i} className="text-icon-md" />
          </button>
        ))}
      </div>
      {error ? <p className="mt-xs text-body-xs text-error">{error}</p> : null}
    </fieldset>
  );
}
