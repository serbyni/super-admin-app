"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { TextField } from "@/components/auth/fields";
import { FormAlert } from "@/components/auth/form-alert";
import { PasswordField } from "@/components/auth/password-field";
import { PhoneField } from "@/components/auth/phone-field";
import { BrandColourPicker } from "@/components/cafe/brand-colour-picker";
import {
  CafeContactFields,
  CafeDetailsFields,
  type CafeContactValues,
  type CafeDetailsValues,
} from "@/components/cafe/cafe-fields";
import { MenuPreview } from "@/components/cafe/menu-preview";
import type { CafeFieldOptions } from "@/config/cafe-options";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import type { FormState } from "@/lib/settings/schema";

type Action = (prev: FormState, form: FormData) => Promise<FormState>;

/**
 * useActionState without React's automatic form reset (it would wipe what the owner typed
 * when the server returns errors). Shows a toast on each successful save.
 */
function useSettingsForm(action: Action, opts?: { resetOnSuccess?: boolean }) {
  const [state, run, pending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const toast = useToast();
  const lastSaved = useRef(0);
  const resetOnSuccess = opts?.resetOnSuccess ?? false;
  useEffect(() => {
    if (state.saved && state.saved !== lastSaved.current) {
      lastSaved.current = state.saved;
      toast.show({ variant: "success", title: state.message ?? "Saved" });
      if (resetOnSuccess) formRef.current?.reset();
    }
  }, [state, toast, resetOnSuccess]);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => run(data));
  };
  return { state, pending, onSubmit, formRef, errors: state.errors ?? {} };
}

export function Section({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl bg-surface-container-lowest p-lg shadow-sm">
      <div className="mb-md">
        <h2 className="flex items-center gap-sm text-headline-md text-on-surface">
          <Icon name={icon} className="text-icon-xl text-primary" />
          {title}
        </h2>
        {description ? (
          <p className="mt-xs text-body-sm text-on-surface-variant">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function SaveButton({ pending, label = "Save changes" }: { pending: boolean; label?: string }) {
  return (
    <div className="mt-lg flex justify-end">
      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-xs rounded-xl bg-primary px-xl py-sm font-semibold text-on-primary shadow-button-warm transition-all hover:bg-primary-container disabled:opacity-60 sm:w-auto"
      >
        <Icon
          name={pending ? "progress_activity" : "check"}
          className={`text-icon-lg ${pending ? "animate-spin" : ""}`}
        />
        {pending ? "Saving…" : label}
      </button>
    </div>
  );
}

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
  const { pending, onSubmit, formRef, errors } = useSettingsForm(action);
  const [seed, setSeed] = useState(values.seed);
  return (
    <form ref={formRef} noValidate onSubmit={onSubmit} className="flex flex-col gap-lg">
      <FormAlert message={errors.form} />
      <Section
        title="Café details"
        icon="storefront"
        description="Shown on your menu. The currency and time zone are used for prices and orders."
      >
        <CafeDetailsFields values={values} errors={errors} options={options} />
      </Section>
      <Section
        title="Contact & social"
        icon="call"
        description="How customers reach your café: phone and email, plus your Facebook and Instagram pages."
      >
        <CafeContactFields values={values} errors={errors} />
      </Section>
      <Section
        title="Brand colour"
        icon="palette"
        description="Your menu's colours are generated from this colour."
      >
        <div className="grid grid-cols-1 gap-lg md:grid-cols-2">
          <BrandColourPicker name="seed" value={seed} onChange={setSeed} />
          <MenuPreview
            name={values.name ?? "Your café"}
            host={host}
            seed={seed}
            currency={values.currency ?? "EUR"}
          />
        </div>
        {errors.seed ? <p className="mt-sm text-body-xs text-error">{errors.seed}</p> : null}
      </Section>
      <div className="sticky bottom-0 -mx-gutter flex justify-end bg-background/90 px-gutter pb-md backdrop-blur md:static md:mx-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <SaveButton pending={pending} />
      </div>
    </form>
  );
}

/* ── Profile tab ──────────────────────────────────────────────────────────── */

export function ProfileForm({
  action,
  fullName,
  phone,
}: {
  action: Action;
  fullName: string;
  phone: string;
}) {
  const { pending, onSubmit, formRef, errors } = useSettingsForm(action);
  return (
    <Section title="Personal details" icon="person" description="Your name and phone number.">
      <form ref={formRef} noValidate onSubmit={onSubmit}>
        <FormAlert message={errors.form} />
        <div className="flex flex-col gap-md">
          <TextField
            id="full_name"
            label="Full name"
            icon="badge"
            required
            autoComplete="name"
            defaultValue={fullName}
            error={errors.full_name}
          />
          <PhoneField id="phone" label="Phone" required defaultValue={phone} error={errors.phone} />
        </div>
        <SaveButton pending={pending} />
      </form>
    </Section>
  );
}

export function EmailForm({
  action,
  email,
  pendingEmail,
}: {
  action: Action;
  email: string;
  pendingEmail: string | null;
}) {
  const { state, pending, onSubmit, formRef, errors } = useSettingsForm(action, {
    resetOnSuccess: true,
  });
  return (
    <Section
      title="Sign-in email"
      icon="mail"
      description="Changing it needs a confirmation: we email a link to the new address (and to your current one). The change happens once confirmed."
    >
      <p className="mb-md text-body-sm text-on-surface-variant">
        Current email: <strong className="text-on-surface">{email}</strong>
      </p>
      {pendingEmail ? (
        <p
          role="status"
          className="mb-md flex items-start gap-xs rounded-lg bg-secondary-container p-sm text-body-sm text-on-secondary-container"
        >
          <Icon name="schedule" className="text-icon-md" />
          Waiting for confirmation of <strong>{pendingEmail}</strong>. Open the link we emailed.
        </p>
      ) : null}
      <form ref={formRef} noValidate onSubmit={onSubmit}>
        <TextField
          id="email"
          type="email"
          label="New email"
          icon="alternate_email"
          required
          autoComplete="email"
          error={errors.email}
        />
        {state.ok && state.message ? (
          <p role="status" className="mt-sm text-body-sm text-success">
            {state.message}
          </p>
        ) : null}
        <SaveButton pending={pending} label="Send confirmation link" />
      </form>
    </Section>
  );
}

export function PasswordForm({ action }: { action: Action }) {
  const { pending, onSubmit, formRef, errors } = useSettingsForm(action, {
    resetOnSuccess: true,
  });
  return (
    <Section
      title="Password"
      icon="lock"
      description="Enter your current password, then the new one. Other devices are signed out."
    >
      <form ref={formRef} noValidate onSubmit={onSubmit}>
        <FormAlert message={errors.form} />
        <div className="flex flex-col gap-md">
          <PasswordField
            id="current_password"
            label="Current password"
            required
            autoComplete="current-password"
            error={errors.current_password}
          />
          <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
            <PasswordField
              id="password"
              label="New password"
              required
              autoComplete="new-password"
              error={errors.password}
            />
            <PasswordField
              id="confirm_password"
              label="Confirm new password"
              required
              autoComplete="new-password"
              error={errors.confirm_password}
            />
          </div>
          <p className="text-caption text-on-surface-variant">
            At least 10 characters with an upper-case letter, a digit and a symbol.
          </p>
        </div>
        <SaveButton pending={pending} label="Change password" />
      </form>
    </Section>
  );
}
