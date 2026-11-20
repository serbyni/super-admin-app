import { getTranslations } from "next-intl/server";
import { Icon } from "@/components/ui/icon";
import { serverApi } from "@/lib/data/server-api";
import { EmailForm, PasswordForm, ProfileForm, UiLanguageForm } from "./profile-forms";

/** Result of /auth/email-change, shown on the Profile tab (?email=confirmed|pending). */
const EMAIL_NOTICE = {
  confirmed: { tone: "success", text: "emailConfirmed" },
  pending: { tone: "info", text: "emailPending" },
} as const;

/**
 * Profile tab (café owners and super admins): dashboard language (owners: `uiLocale`),
 * name + phone, sign-in email, password.
 */
export async function ProfileTab({
  emailResult,
  pendingEmail,
  uiLocale,
}: {
  emailResult?: string | string[];
  pendingEmail: string | null;
  uiLocale?: string;
}) {
  const [profile, t] = await Promise.all([
    serverApi().owners.profile(),
    getTranslations("profile"),
  ]);
  const notice =
    emailResult === "confirmed" || emailResult === "pending"
      ? EMAIL_NOTICE[emailResult]
      : undefined;
  return (
    <div className="flex flex-col gap-lg">
      {notice ? (
        <p
          role="status"
          className={`flex items-start gap-xs rounded-lg p-md text-body-sm font-semibold ${
            notice.tone === "success"
              ? "bg-success-container text-success"
              : "bg-secondary-container text-on-secondary-container"
          }`}
        >
          <Icon
            name={notice.tone === "success" ? "check_circle" : "info"}
            className="text-icon-lg"
          />
          {t(notice.text)}
        </p>
      ) : null}
      {uiLocale ? <UiLanguageForm current={uiLocale} /> : null}
      <ProfileForm fullName={profile.fullName ?? ""} phone={profile.phone ?? ""} />
      <EmailForm email={profile.email ?? ""} pendingEmail={pendingEmail} />
      <PasswordForm />
    </div>
  );
}
