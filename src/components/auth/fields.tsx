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

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  icon: string;
  trailing?: ReactNode;
};

export function TextField({ id, label, icon, trailing, required, ...rest }: TextFieldProps) {
  return (
    <div>
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      <div className="relative flex items-center">
        <Icon
          name={icon}
          className="pointer-events-none absolute start-3.5 text-[20px] text-on-surface-variant"
        />
        <input id={id} name={id} required={required} className={inputClass} {...rest} />
        {trailing}
      </div>
    </div>
  );
}

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  id: string;
  label: string;
  icon: string;
  placeholder: string;
  options: { value: string; label: string }[];
};

export function SelectField({
  id,
  label,
  icon,
  placeholder,
  options,
  required,
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
          className="pointer-events-none absolute start-3.5 text-[20px] text-on-surface-variant"
        />
        <select
          id={id}
          name={id}
          required={required}
          defaultValue=""
          className={`${inputClass} cursor-pointer appearance-none pe-10`}
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
          className="pointer-events-none absolute end-3 text-[20px] text-on-surface-variant"
        />
      </div>
    </div>
  );
}
