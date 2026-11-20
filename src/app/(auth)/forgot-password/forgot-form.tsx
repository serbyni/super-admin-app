"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useActionState, useEffect } from "react";
import { TextField } from "@/components/auth/fields";
import { FormAlert } from "@/components/auth/form-alert";
import { SubmitButton } from "@/components/auth/submit-button";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { requestPasswordReset, type ForgotState } from "./actions";

export function ForgotPasswordForm() {
  const [state, action] = useActionState<ForgotState, FormData>(requestPasswordReset, {});
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const t = useTranslations("forgot");

  // /auth/reset sends expired or used links back here.
  useEffect(() => {
    if (params.get("error") !== "link_expired") return;
    toast.show({
      id: "reset-link-expired",
      variant: "error",
      title: t("expiredTitle"),
      description: t("expiredBody"),
    });
    router.replace(pathname, { scroll: false });
  }, [params, pathname, router, toast, t]);

  if (state.sent) {
    return (
      <div role="status" className="flex flex-col items-center gap-md text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-container text-success">
          <Icon name="mark_email_read" className="text-icon-2xl" />
        </span>
        <div>
          <p className="text-headline-md text-on-surface">{t("inboxTitle")}</p>
          <p className="mt-xs text-on-surface-variant">
            {t.rich("inboxBody", {
              email: state.email ?? "",
              b: (c) => <strong className="text-on-surface">{c}</strong>,
            })}
          </p>
        </div>
        <p className="text-body-sm text-on-surface-variant">{t("noEmail")}</p>
      </div>
    );
  }

  return (
    <form action={action} noValidate className="space-y-5">
      <FormAlert message={state.error} />
      <TextField
        id="email"
        label={t("email")}
        icon="mail"
        type="email"
        autoComplete="email"
        placeholder="owner@yourcafe.com"
        required
        defaultValue={state.email}
      />
      <SubmitButton icon="send" pendingLabel={t("sending")}>
        {t("send")}
      </SubmitButton>
      <div className="flex items-center justify-center gap-2 py-1 text-center">
        <Icon name="schedule" className="text-icon-sm text-tertiary" />
        <p className="font-label-sm text-label-sm font-normal text-on-surface-variant">
          {t("expires")}
        </p>
      </div>
    </form>
  );
}
