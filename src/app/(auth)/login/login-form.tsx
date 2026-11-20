"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useActionState, useEffect } from "react";
import { useMsg } from "@/i18n/use-msg";
import { TextField } from "@/components/auth/fields";
import { PasswordField } from "@/components/auth/password-field";
import { SubmitButton } from "@/components/auth/submit-button";
import { useToast, type ToastOptions } from "@/components/ui/toast";
import { signIn, type LoginState } from "./actions";

type T = ReturnType<typeof useTranslations<"login">>;

/** Errors passed in the URL (?error=…) by redirects such as /auth/callback. */
function queryToast(t: T, error: string, provider: string | null): ToastOptions | null {
  const name = provider ? provider[0].toUpperCase() + provider.slice(1) : t("thisProvider");
  switch (error) {
    case "no_account":
      return {
        id: "login-no-account",
        variant: "error",
        title: t("noAccountTitle", { provider: name }),
        description: t("noAccountBody"),
        actions: [{ label: t("register"), href: "/register" }],
        duration: null,
      };
    case "link_invalid":
      return {
        id: "login-link",
        variant: "error",
        title: t("linkInvalid"),
        description: t("linkInvalidBody"),
      };
    default:
      return null;
  }
}

export function LoginForm() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const t = useTranslations("login");
  const m = useMsg();
  const [state, action] = useActionState<LoginState, FormData>(signIn, {});

  // Errors from redirects: show once, then drop them from the URL.
  useEffect(() => {
    const error = params.get("error");
    if (!error) return;
    const q = queryToast(t, error, params.get("provider"));
    if (q) toast.show(q);
    const rest = new URLSearchParams(params);
    rest.delete("error");
    rest.delete("provider");
    router.replace(rest.size ? `${pathname}?${rest}` : pathname, { scroll: false });
  }, [params, pathname, router, toast, t]);

  // Sign-in errors.
  useEffect(() => {
    if (!state.error) return;
    toast.show({
      id: "login-error",
      variant: "error",
      title: m(state.error),
      description: state.code === "invalid_credentials" ? t("newToSerbi") : undefined,
      actions:
        state.code === "invalid_credentials"
          ? [{ label: t("createAccount"), href: "/register" }]
          : undefined,
    });
  }, [state, toast, t, m]);

  return (
    <form action={action} noValidate className="space-y-4">
      <input type="hidden" name="next" value={params.get("next") ?? ""} />
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
      <PasswordField
        id="password"
        label={t("password")}
        autoComplete="current-password"
        placeholder="••••••••••"
        required
      />
      <div className="flex flex-col justify-between gap-2 pt-1 sm:flex-row sm:items-center">
        <span className="text-body-sm text-on-surface-variant">{t("staySignedIn")}</span>
        <Link
          href="/forgot-password"
          className="self-start font-label-sm text-label-sm tracking-wide text-primary transition-colors hover:text-primary-container sm:self-auto"
        >
          {t("forgot")}
        </Link>
      </div>
      <SubmitButton icon="login" pendingLabel={t("signingIn")}>
        {t("signIn")}
      </SubmitButton>
    </form>
  );
}
