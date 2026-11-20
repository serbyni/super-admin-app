"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { TextField } from "@/components/auth/fields";
import { FormAlert } from "@/components/auth/form-alert";
import { PasswordField } from "@/components/auth/password-field";
import { PhoneField } from "@/components/auth/phone-field";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { UI_LANGUAGE_NAMES, UI_LOCALES } from "@/i18n/config";
import { useMsg } from "@/i18n/use-msg";
import {
  changeEmailAction,
  changePasswordAction,
  saveProfileAction,
  setUiLanguageAction,
} from "./profile-actions";
import { SaveButton, Section, useSettingsForm } from "./form-kit";

/* Profile forms (café owners and super admins): name + phone, sign-in email, password. */

/** Owners: language of the dashboard and of Serbi's e-mails (saved at once; the page reloads). */
export function UiLanguageForm({ current }: { current: string }) {
  const t = useTranslations("profile");
  const m = useMsg();
  const toast = useToast();
  const [value, setValue] = useState(current);
  const [pending, start] = useTransition();
  return (
    <Section title={t("languageTitle")} icon="translate" description={t("languageBody")}>
      <div role="radiogroup" aria-label={t("languageTitle")} className="flex flex-wrap gap-sm">
        {UI_LOCALES.map((l) => (
          <button
            key={l}
            type="button"
            role="radio"
            lang={l}
            aria-checked={value === l}
            disabled={pending}
            onClick={() => {
              if (l === value) return;
              setValue(l);
              start(async () => {
                const r = await setUiLanguageAction(l);
                if (r.ok) window.location.reload();
                else {
                  setValue(current);
                  toast.show({ variant: "error", title: m(r.message) });
                }
              });
            }}
            className={`inline-flex items-center gap-xs rounded-full border px-md py-sm text-body-sm font-semibold transition-colors disabled:opacity-60 ${
              value === l
                ? "border-primary bg-primary text-on-primary"
                : "border-outline-variant text-on-surface hover:bg-surface-container-low"
            }`}
          >
            {value === l ? (
              <Icon
                name={pending ? "progress_activity" : "check"}
                className={`text-icon-md ${pending ? "animate-spin" : ""}`}
              />
            ) : null}
            {UI_LANGUAGE_NAMES[l]}
          </button>
        ))}
      </div>
    </Section>
  );
}

export function ProfileForm({ fullName, phone }: { fullName: string; phone: string }) {
  const t = useTranslations("profile");
  const { pending, onSubmit, formRef, errors } = useSettingsForm(saveProfileAction);
  return (
    <Section title={t("personalTitle")} icon="person" description={t("personalBody")}>
      <form ref={formRef} noValidate onSubmit={onSubmit}>
        <FormAlert message={errors.form} />
        <div className="flex flex-col gap-md">
          <TextField
            id="full_name"
            label={t("fullName")}
            icon="badge"
            required
            autoComplete="name"
            defaultValue={fullName}
            error={errors.full_name}
          />
          <PhoneField
            id="phone"
            label={t("phone")}
            required
            defaultValue={phone}
            error={errors.phone}
          />
        </div>
        <SaveButton pending={pending} />
      </form>
    </Section>
  );
}

export function EmailForm({ email, pendingEmail }: { email: string; pendingEmail: string | null }) {
  const t = useTranslations("profile");
  const m = useMsg();
  const { state, pending, onSubmit, formRef, errors } = useSettingsForm(changeEmailAction, {
    resetOnSuccess: true,
  });
  return (
    <Section title={t("emailTitle")} icon="mail" description={t("emailBody")}>
      <p className="mb-md text-body-sm text-on-surface-variant">
        {t("currentEmail")}{" "}
        <strong className="text-on-surface" dir="ltr">
          {email}
        </strong>
      </p>
      {pendingEmail ? (
        <p
          role="status"
          className="mb-md flex items-start gap-xs rounded-lg bg-secondary-container p-sm text-body-sm text-on-secondary-container"
        >
          <Icon name="schedule" className="text-icon-md" />
          <span>
            {t.rich("waitingFor", {
              email: pendingEmail,
              b: (chunks) => <strong dir="ltr">{chunks}</strong>,
            })}
          </span>
        </p>
      ) : null}
      <form ref={formRef} noValidate onSubmit={onSubmit}>
        <TextField
          id="email"
          type="email"
          label={t("newEmail")}
          icon="alternate_email"
          required
          autoComplete="email"
          error={errors.email}
        />
        {state.ok && state.message ? (
          <p role="status" className="mt-sm text-body-sm text-success">
            {m(state.message)}
          </p>
        ) : null}
        <SaveButton pending={pending} label={t("sendLink")} />
      </form>
    </Section>
  );
}

export function PasswordForm() {
  const t = useTranslations("profile");
  const { pending, onSubmit, formRef, errors } = useSettingsForm(changePasswordAction, {
    resetOnSuccess: true,
  });
  return (
    <Section title={t("passwordTitle")} icon="lock" description={t("passwordBody")}>
      <form ref={formRef} noValidate onSubmit={onSubmit}>
        <FormAlert message={errors.form} />
        <div className="flex flex-col gap-md">
          <PasswordField
            id="current_password"
            label={t("currentPassword")}
            required
            autoComplete="current-password"
            error={errors.current_password}
          />
          <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
            <PasswordField
              id="password"
              label={t("newPassword")}
              required
              autoComplete="new-password"
              error={errors.password}
            />
            <PasswordField
              id="confirm_password"
              label={t("confirmPassword")}
              required
              autoComplete="new-password"
              error={errors.confirm_password}
            />
          </div>
          <p className="text-caption text-on-surface-variant">{t("passwordRules")}</p>
        </div>
        <SaveButton pending={pending} label={t("changePassword")} />
      </form>
    </Section>
  );
}
