"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  type FormEvent,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/icon";
import { useMsg } from "@/i18n/use-msg";
import { useToast } from "@/components/ui/toast";
import type { FormState } from "@/lib/settings/schema";

/* Building blocks of the settings forms (café settings, profile — owners and super admins). */

export type Action = (prev: FormState, form: FormData) => Promise<FormState>;

/**
 * useActionState without React's automatic form reset (it would wipe what the owner typed
 * when the server returns errors). Shows a toast on each successful save.
 */
export function useSettingsForm(action: Action, opts?: { resetOnSuccess?: boolean }) {
  const [state, run, pending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const toast = useToast();
  const m = useMsg();
  const lastSaved = useRef(0);
  const resetOnSuccess = opts?.resetOnSuccess ?? false;
  useEffect(() => {
    if (state.saved && state.saved !== lastSaved.current) {
      lastSaved.current = state.saved;
      toast.show({ variant: "success", title: m(state.message ?? "§saved") });
      if (resetOnSuccess) formRef.current?.reset();
    }
  }, [state, toast, resetOnSuccess, m]);
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

export function SaveButton({ pending, label }: { pending: boolean; label?: string }) {
  const t = useTranslations("common");
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
        {pending ? t("saving") : (label ?? t("saveChanges"))}
      </button>
    </div>
  );
}
