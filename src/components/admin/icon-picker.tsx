"use client";

import { useId, useMemo, useRef, useState } from "react";
import { FieldError, FieldLabel } from "@/components/auth/fields";
import { Icon } from "@/components/ui/icon";
import { BUSINESS_ICON_GROUPS, iconLabel } from "@/config/business-icons";

type IconPickerProps = {
  name: string;
  label: string;
  defaultValue: string;
  error?: string;
};

/** Click the preview to open a searchable grid of curated Material Symbols; submits `name`. */
export function IconPicker({ name, label, defaultValue, error }: IconPickerProps) {
  const [value, setValue] = useState(defaultValue);
  const [query, setQuery] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\s+/g, "_");
    return BUSINESS_ICON_GROUPS.map((g) => ({
      label: g.label,
      icons: g.icons.filter((i) => !q || i.includes(q)),
    })).filter((g) => g.icons.length > 0);
  }, [query]);

  function open() {
    setQuery("");
    dialogRef.current?.showModal();
  }

  function choose(icon: string) {
    setValue(icon);
    dialogRef.current?.close();
  }

  return (
    <div>
      <FieldLabel htmlFor={`${name}-trigger`} required>
        {label}
      </FieldLabel>
      <input type="hidden" name={name} value={value} />
      <button
        id={`${name}-trigger`}
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        className={`group flex w-full items-center gap-sm rounded-lg bg-surface-container-low p-sm text-start transition-colors hover:bg-surface-container ${
          error ? "ring-2 ring-error" : ""
        }`}
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary-container text-primary transition-transform group-hover:scale-105">
          <Icon name={value} className="text-icon-xl" />
        </span>
        <span className="flex-1">
          <span className="block text-body-sm font-semibold text-on-surface">
            {iconLabel(value)}
          </span>
          <span className="block text-caption text-on-surface-variant">
            Click to choose an icon
          </span>
        </span>
        <Icon name="edit" className="text-icon-md text-on-surface-variant" />
      </button>
      <FieldError id={name} message={error} />

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="m-auto w-full max-w-2xl rounded-xl bg-surface-container-lowest p-0 text-on-surface shadow-card-warm backdrop:bg-inverse-surface/50 backdrop:backdrop-blur-sm"
      >
        <div className="flex items-center justify-between gap-sm border-b border-surface-container-high px-lg py-md">
          <h2 id={titleId} className="text-headline-md text-primary">
            Choose an icon
          </h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container"
          >
            <Icon name="close" className="text-icon-lg" />
          </button>
        </div>
        <div className="px-lg pt-md">
          <div className="relative flex items-center">
            <Icon
              name="search"
              className="pointer-events-none absolute start-3 text-icon-lg text-on-surface-variant"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search icons, e.g. pizza"
              aria-label="Search icons"
              className="w-full rounded-lg bg-surface-container-low py-sm ps-10 pe-4 text-body-md placeholder:text-outline focus:ring-2 focus:ring-primary-container focus:outline-none"
            />
          </div>
        </div>
        <div className="max-h-96 overflow-y-auto px-lg py-md">
          {groups.length === 0 ? (
            <p className="py-lg text-center text-on-surface-variant">No icon matches “{query}”.</p>
          ) : (
            groups.map((g) => (
              <section key={g.label} className="mb-md">
                <h3 className="mb-sm font-label-sm text-label-sm tracking-wider text-secondary uppercase">
                  {g.label}
                </h3>
                <div className="grid grid-cols-4 gap-sm sm:grid-cols-6">
                  {g.icons.map((icon) => {
                    const selected = icon === value;
                    return (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => choose(icon)}
                        aria-pressed={selected}
                        title={iconLabel(icon)}
                        className={`flex flex-col items-center gap-xs rounded-lg p-sm transition-colors ${
                          selected
                            ? "bg-primary-container text-on-primary ring-2 ring-primary"
                            : "bg-surface-container-low text-primary hover:bg-secondary-container"
                        }`}
                      >
                        <Icon name={icon} className="text-icon-xl" />
                        <span className="line-clamp-1 text-caption">{iconLabel(icon)}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>
      </dialog>
    </div>
  );
}
