"use client";

import { useTranslations } from "next-intl";
import { useMsg } from "@/i18n/use-msg";
import { useActionState } from "react";
import { Icon } from "@/components/ui/icon";
import { resendConfirmation, type ResendState } from "../actions";

export function ResendForm({ email }: { email: string }) {
  const t = useTranslations("checkEmail");
  const m = useMsg();
  const [state, action, pending] = useActionState<ResendState, FormData>(resendConfirmation, {});
  return (
    <form action={action} className="flex flex-col items-center gap-xs">
      <input type="hidden" name="email" value={email} />
      <button
        type="submit"
        disabled={pending || state.sent}
        className="inline-flex items-center gap-xs font-label-sm text-label-sm tracking-wider text-primary uppercase transition-colors hover:text-primary-container disabled:opacity-60"
      >
        <Icon name={state.sent ? "check_circle" : "forward_to_inbox"} className="text-icon-md" />
        {state.sent ? t("sentAgain") : pending ? t("sending") : t("resend")}
      </button>
      {state.error ? (
        <p role="alert" className="text-body-xs text-error">
          {m(state.error)}
        </p>
      ) : null}
    </form>
  );
}
