"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useActionState, useEffect } from "react";
import { TextField } from "@/components/auth/fields";
import { FormAlert } from "@/components/auth/form-alert";
import { SubmitButton } from "@/components/auth/submit-button";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { requestPasswordReset, type ForgotState } from "./actions";

export function ForgotPasswordForm() {
  const [state, action] = useActionState<ForgotState, FormData>(requestPasswordReset, {});
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();

  // /auth/reset sends expired or used links back here.
  useEffect(() => {
    if (params.get("error") !== "link_expired") return;
    toast.show({
      id: "reset-link-expired",
      variant: "error",
      title: "This reset link has expired or was already used",
      description: "Request a new link below.",
    });
    router.replace(pathname, { scroll: false });
  }, [params, pathname, router, toast]);

  if (state.sent) {
    return (
      <div role="status" className="flex flex-col items-center gap-md text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-container text-success">
          <Icon name="mark_email_read" className="text-icon-2xl" />
        </span>
        <div>
          <p className="text-headline-md text-on-surface">Check your inbox</p>
          <p className="mt-xs text-on-surface-variant">
            If an account exists for <strong className="text-on-surface">{state.email}</strong>, we
            sent a link to choose a new password. It expires after a short time.
          </p>
        </div>
        <p className="text-body-sm text-on-surface-variant">
          No email after a few minutes? Check your spam folder, or try again in a minute.
        </p>
      </div>
    );
  }

  return (
    <form action={action} noValidate className="space-y-5">
      <FormAlert message={state.error} />
      <TextField
        id="email"
        label="Email address"
        icon="mail"
        type="email"
        autoComplete="email"
        placeholder="owner@yourcafe.com"
        required
        defaultValue={state.email}
      />
      <SubmitButton icon="send" pendingLabel="Sending…">
        Send reset link
      </SubmitButton>
      <div className="flex items-center justify-center gap-2 py-1 text-center">
        <Icon name="schedule" className="text-icon-sm text-tertiary" />
        <p className="font-label-sm text-label-sm font-normal text-on-surface-variant">
          For security, the link expires after a short time.
        </p>
      </div>
    </form>
  );
}
