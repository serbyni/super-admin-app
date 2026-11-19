"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Icon } from "./icon";

/*
 * App dialogs on the native <dialog> element (showModal): focus is trapped inside, Esc closes,
 * the page behind is inert, and the backdrop is themed. Use instead of window.alert/confirm.
 */

type DialogProps = {
  open: boolean;
  /** Called on Esc, backdrop click or the close button. */
  onClose: () => void;
  title: string;
  description?: ReactNode;
  /** Material Symbol shown in a tinted circle above the title. */
  icon?: string;
  tone?: Tone;
  children?: ReactNode;
  /** Buttons row (right-aligned on desktop, stacked on mobile). */
  actions?: ReactNode;
  /** Block Esc/backdrop closing while something is running. */
  dismissible?: boolean;
};

export type Tone = "primary" | "success" | "danger";

const TONE: Record<Tone, { badge: string; button: string }> = {
  primary: {
    badge: "bg-secondary-container text-primary",
    button: "bg-primary text-on-primary hover:bg-primary-container",
  },
  success: {
    badge: "bg-success-container text-success",
    button: "bg-success text-on-primary hover:opacity-90",
  },
  danger: {
    badge: "bg-error-container text-error",
    button: "bg-error text-on-error hover:opacity-90",
  },
};

export function Dialog({
  open,
  onClose,
  title,
  description,
  icon,
  tone = "primary",
  children,
  actions,
  dismissible = true,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        // Esc: keep React in control of `open`.
        e.preventDefault();
        if (dismissible) onClose();
      }}
      onClick={(e) => {
        // Click on the backdrop (the dialog element itself, outside the panel).
        if (e.target === e.currentTarget && dismissible) onClose();
      }}
      className="m-auto w-11/12 max-w-card-sm rounded-xl bg-surface-container-lowest p-0 text-on-surface shadow-card-warm backdrop:bg-inverse-surface/50 backdrop:backdrop-blur-sm"
    >
      <div className="flex flex-col gap-md p-lg">
        <div className="flex items-start gap-md">
          {icon ? (
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${TONE[tone].badge}`}
            >
              <Icon name={icon} className="text-icon-xl" />
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-headline-md text-on-surface">
              {title}
            </h2>
            {description ? (
              <div id={descId} className="mt-xs text-body-sm text-on-surface-variant">
                {description}
              </div>
            ) : null}
          </div>
          {dismissible ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-me-xs -mt-xs flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container"
            >
              <Icon name="close" className="text-icon-lg" />
            </button>
          ) : null}
        </div>
        {children}
        {actions ? (
          <div className="flex flex-col-reverse gap-sm sm:flex-row sm:justify-end">{actions}</div>
        ) : null}
      </div>
    </dialog>
  );
}

type ConfirmDialogProps = Omit<DialogProps, "actions" | "children" | "dismissible"> & {
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  /** Shows a spinner on the confirm button and blocks closing. */
  pending?: boolean;
  children?: ReactNode;
};

/** Yes/No question in our design (replaces window.confirm). */
export function ConfirmDialog({
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  pending = false,
  tone = "primary",
  onClose,
  ...rest
}: ConfirmDialogProps) {
  return (
    <Dialog
      {...rest}
      tone={tone}
      onClose={onClose}
      dismissible={!pending}
      actions={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-xl px-lg py-sm font-semibold text-on-surface-variant hover:bg-surface-container focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:outline-none disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            autoFocus
            className={`flex items-center justify-center gap-xs rounded-xl px-lg py-sm font-semibold shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60 ${TONE[tone].button}`}
          >
            {pending ? (
              <Icon name="progress_activity" className="animate-spin text-icon-lg" />
            ) : null}
            {confirmLabel}
          </button>
        </>
      }
    />
  );
}
