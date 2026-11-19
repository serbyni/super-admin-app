"use client";

import { TextField } from "@/components/auth/fields";
import { FormAlert } from "@/components/auth/form-alert";
import { PasswordField } from "@/components/auth/password-field";
import { PhoneField } from "@/components/auth/phone-field";
import { Icon } from "@/components/ui/icon";
import { changeEmailAction, changePasswordAction, saveProfileAction } from "./profile-actions";
import { SaveButton, Section, useSettingsForm } from "./form-kit";

/* Profile forms (café owners and super admins): name + phone, sign-in email, password. */

export function ProfileForm({ fullName, phone }: { fullName: string; phone: string }) {
  const { pending, onSubmit, formRef, errors } = useSettingsForm(saveProfileAction);
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

export function EmailForm({ email, pendingEmail }: { email: string; pendingEmail: string | null }) {
  const { state, pending, onSubmit, formRef, errors } = useSettingsForm(changeEmailAction, {
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

export function PasswordForm() {
  const { pending, onSubmit, formRef, errors } = useSettingsForm(changePasswordAction, {
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
