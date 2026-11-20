import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { Icon } from "@/components/ui/icon";
import { FieldError } from "./field-error";

export { FieldError };

/*
 * Material 3 "outlined" text fields with a floating label.
 *
 * At rest (empty, not focused) the label sits inside the box like a placeholder.
 * On focus or once filled it moves up into a notch in the border (the label gets the
 * card background, `bg-field-notch`, to cut the outline). Pure CSS: the input is the
 * `peer` and must come BEFORE the label in the DOM; emptiness is `:placeholder-shown`
 * (inputs) or `:invalid` (required selects with the empty option).
 */

/** Outlined box. Example placeholders only show while the field is focused. */
export const outlinedBox = (error?: string) =>
  `peer w-full rounded-lg border bg-transparent py-3.5 text-body-md text-on-surface transition-colors placeholder:text-outline placeholder:opacity-0 placeholder:transition-opacity focus:placeholder:opacity-100 focus:outline-none focus:ring-1 ${
    error
      ? "border-error focus:border-error focus:ring-error"
      : "border-outline-variant hover:border-outline focus:border-primary focus:ring-primary"
  }`;

/** Floated label position (sits on the top border). */
const floated =
  "pointer-events-none absolute start-3 top-0 z-10 max-w-full -translate-y-1/2 truncate bg-field-notch px-1 text-body-xs font-semibold transition-all duration-150";

/** Resting position for inputs: inside the box, while the placeholder is shown and not focused. */
const restingInput = (withIcon: boolean) =>
  `peer-placeholder-shown:top-1/2 peer-placeholder-shown:text-body-md peer-placeholder-shown:font-normal ${
    withIcon ? "peer-placeholder-shown:start-10" : "peer-placeholder-shown:start-3"
  } peer-focus:top-0 peer-focus:start-3 peer-focus:text-body-xs peer-focus:font-semibold`;

/** Resting position for required selects: while the empty option is selected and not focused. */
const restingSelect =
  "peer-invalid:top-1/2 peer-invalid:start-10 peer-invalid:text-body-md peer-invalid:font-normal peer-focus:top-0 peer-focus:start-3 peer-focus:text-body-xs peer-focus:font-semibold";

const labelColor = (error?: string) =>
  error ? "text-error" : "text-on-surface-variant peer-focus:text-primary";

function RequiredMark({ required }: { required?: boolean }) {
  return required ? <span className="ms-0.5 text-error">*</span> : null;
}

/** Label that floats on the border (use after a `peer` input/select). */
export function FloatingLabel({
  htmlFor,
  children,
  required,
  error,
  withIcon = false,
  rest = "input",
}: {
  htmlFor: string;
  children: ReactNode;
  required?: boolean;
  error?: string;
  withIcon?: boolean;
  /** How the label knows the field is empty: input placeholder, select :invalid, or never (always floated). */
  rest?: "input" | "select" | "never";
}) {
  const resting =
    rest === "input" ? restingInput(withIcon) : rest === "select" ? restingSelect : "";
  return (
    <label htmlFor={htmlFor} className={`${floated} ${resting} ${labelColor(error)}`}>
      {children}
      <RequiredMark required={required} />
    </label>
  );
}

/** Static label above a control (for non-text controls such as pickers and checkboxes). */
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
      <RequiredMark required={required} />
    </label>
  );
}

export function FieldHint({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={`${id}-hint`} className="mt-1 ps-3 text-caption text-on-surface-variant">
      {children}
    </p>
  );
}

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  icon?: string;
  trailing?: ReactNode;
  error?: string;
  hint?: ReactNode;
};

export function TextField({
  id,
  label,
  icon,
  trailing,
  required,
  error,
  hint,
  placeholder,
  ...rest
}: TextFieldProps) {
  return (
    <div>
      <div className="relative flex items-center">
        <input
          id={id}
          name={id}
          required={required}
          // :placeholder-shown drives the floating label, so a placeholder is always set.
          placeholder={placeholder ?? " "}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={`${outlinedBox(error)} ${icon ? "ps-11" : "ps-4"} ${trailing ? "pe-11" : "pe-4"}`}
          {...rest}
        />
        {icon ? (
          <Icon
            name={icon}
            className="pointer-events-none absolute start-3.5 text-icon-lg text-on-surface-variant"
          />
        ) : null}
        <FloatingLabel htmlFor={id} required={required} error={error} withIcon={!!icon}>
          {label}
        </FloatingLabel>
        {trailing}
      </div>
      {error ? (
        <FieldError id={id} message={error} />
      ) : hint ? (
        <FieldHint id={id}>{hint}</FieldHint>
      ) : null}
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
      <div className="relative flex items-center">
        <select
          id={id}
          name={id}
          required={required}
          defaultValue={defaultValue ?? ""}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          // While empty (and not focused) the text is hidden so the resting label shows instead.
          className={`${outlinedBox(error)} cursor-pointer appearance-none ps-11 pe-10 invalid:text-transparent focus:text-on-surface`}
          {...rest}
        >
          <option value="" disabled className="text-on-surface-variant">
            {placeholder}
          </option>
          {options.map((o) => (
            <option key={o.value} value={o.value} className="text-on-surface">
              {o.label}
            </option>
          ))}
        </select>
        <Icon
          name={icon}
          className="pointer-events-none absolute start-3.5 text-icon-lg text-on-surface-variant"
        />
        <FloatingLabel
          htmlFor={id}
          required={required}
          error={error}
          withIcon
          rest={required ? "select" : "never"}
        >
          {label}
        </FloatingLabel>
        <Icon
          name="expand_more"
          className="pointer-events-none absolute end-3 text-icon-lg text-on-surface-variant"
        />
      </div>
      <FieldError id={id} message={error} />
    </div>
  );
}

type TextAreaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
};

/** Multi-line outlined field; the label floats like TextField's. */
export function TextAreaField({
  id,
  label,
  required,
  error,
  hint,
  placeholder,
  rows = 4,
  ...rest
}: TextAreaFieldProps) {
  return (
    <div>
      <div className="relative">
        <textarea
          id={id}
          name={id}
          rows={rows}
          required={required}
          placeholder={placeholder ?? " "}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={`${outlinedBox(error)} block resize-y px-4`}
          {...rest}
        />
        <label
          htmlFor={id}
          className={`${floated} peer-placeholder-shown:top-7 peer-placeholder-shown:text-body-md peer-placeholder-shown:font-normal peer-focus:top-0 peer-focus:text-body-xs peer-focus:font-semibold ${labelColor(error)}`}
        >
          {label}
          <RequiredMark required={required} />
        </label>
      </div>
      {error ? (
        <FieldError id={id} message={error} />
      ) : hint ? (
        <FieldHint id={id}>{hint}</FieldHint>
      ) : null}
    </div>
  );
}
