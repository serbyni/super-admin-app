import { Icon } from "@/components/ui/icon";
import { serverApi } from "@/lib/data/server-api";
import { EmailForm, PasswordForm, ProfileForm } from "./profile-forms";

/** Result of /auth/email-change, shown on the Profile tab (?email=confirmed|pending). */
const EMAIL_NOTICE: Record<string, { tone: "success" | "info"; text: string }> = {
  confirmed: { tone: "success", text: "Your sign-in email was changed." },
  pending: {
    tone: "info",
    text: "Confirmed. Now open the link we sent to your other address to finish the change.",
  },
};

/** Profile tab (café owners and super admins): name + phone, sign-in email, password. */
export async function ProfileTab({
  emailResult,
  pendingEmail,
}: {
  emailResult?: string | string[];
  pendingEmail: string | null;
}) {
  const profile = await serverApi().owners.profile();
  const notice = typeof emailResult === "string" ? EMAIL_NOTICE[emailResult] : undefined;
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
          {notice.text}
        </p>
      ) : null}
      <ProfileForm fullName={profile.fullName ?? ""} phone={profile.phone ?? ""} />
      <EmailForm email={profile.email ?? ""} pendingEmail={pendingEmail} />
      <PasswordForm />
    </div>
  );
}
