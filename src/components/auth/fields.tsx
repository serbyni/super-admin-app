import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { Icon } from "@/components/ui/icon";

const inputClass =
  "w-full rounded-lg bg-surface-container-low py-3 ps-11 pe-4 font-body-md text-body-md text-on-surface transition-all placeholder:text-outline focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary-container focus:outline-none";

export function FieldLabel({
  htmlFor,
  children,
  required,
}: {
  htmlFor: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block font-label-sm text-label-sm tracking-wider text-secondary uppercase"
    >
      {children}
      {required ? <span className="ms-0.5 text-error">*</span> : null}
    </label>
  );
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={`${id}-error`} role="alert" className="mt-1 text-body-xs text-error">
      {message}
    </p>
  );
}

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  icon: string;
  trailing?: ReactNode;
  error?: string;
};

export function TextField({ id, label, icon, trailing, required, error, ...rest }: TextFieldProps) {
  return (
    <div>
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      <div className="relative flex items-center">
        <Icon
          name={icon}
          className="pointer-events-none absolute start-3.5 text-icon-lg text-on-surface-variant"
        />
        <input
          id={id}
          name={id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`${inputClass} ${error ? "ring-2 ring-error" : ""}`}
          {...rest}
        />
        {trailing}
      </div>
      <FieldError id={id} message={error} />
    </div>
  );
}

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  id: string;
  label: string;
  icon: string;
  placeholder: string;
  options: { value: string; label: string }[];
  error?: string;
};

export function SelectField({
  id,
  label,
  icon,
  placeholder,
  options,
  required,
  error,
  defaultValue,
  ...rest
}: SelectFieldProps) {
  return (
    <div>
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      <div className="relative flex items-center">
        <Icon
          name={icon}
          className="pointer-events-none absolute start-3.5 text-icon-lg text-on-surface-variant"
        />
        <select
          id={id}
          name={id}
          required={required}
          defaultValue={defaultValue ?? ""}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`${inputClass} cursor-pointer appearance-none pe-10 ${error ? "ring-2 ring-error" : ""}`}
          {...rest}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Icon
          name="expand_more"
          className="pointer-events-none absolute end-3 text-icon-lg text-on-surface-variant"
        />
      </div>
      <FieldError id={id} message={error} />
    </div>
  );
}
