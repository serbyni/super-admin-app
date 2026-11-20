"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { TextAreaField } from "@/components/auth/fields";
import { Section } from "@/components/settings/form-kit";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import type { MyLanguages } from "@/lib/data/services/languages";
import { useLanguageLabel } from "@/i18n/use-language-label";
import { useMsg } from "@/i18n/use-msg";
import { BASE_LANGUAGES } from "@/lib/i18n/languages";
import { requestLanguageAction, setLanguagesAction, type LanguagesResult } from "./actions";

const STATUS = {
  pending: "bg-warning-container text-on-warning-container",
  approved: "bg-success-container text-success",
  declined: "bg-error-container text-on-error-container",
} as const;

/** Settings → Languages: languages the café offers, and requests for extra languages. */
export function LanguagesTab({
  slug,
  languages,
  dates,
}: {
  slug: string;
  languages: MyLanguages;
  dates: Record<string, string>;
}) {
  const t = useTranslations("languagesTab");
  const m = useMsg();
  const languageLabel = useLanguageLabel();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [offered, setOffered] = useState<string[]>(languages.offered);
  const pendingLocales = languages.requests
    .filter((r) => r.status === "pending")
    .map((r) => r.locale);
  const requestable = languages.supported.filter(
    (l) => !languages.available.includes(l) && !pendingLocales.includes(l),
  );
  const [locale, setLocale] = useState(requestable[0] ?? "");
  const [note, setNote] = useState("");
  const dirty = [...offered].sort().join() !== [...languages.offered].sort().join();
  // Main language first, then base languages, then approved extras.
  const available = [
    languages.main,
    ...BASE_LANGUAGES.filter((l) => l !== languages.main),
    ...languages.extras.filter((l) => l !== languages.main),
  ];

  const run = (fn: () => Promise<LanguagesResult>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      toast.show({ variant: r.ok ? "success" : "error", title: m(r.message) });
      if (r.ok) after?.();
    });

  return (
    <div className="flex flex-col gap-lg">
      <Section title={t("offeredTitle")} icon="translate" description={t("offeredBody")}>
        <ul className="flex flex-col divide-y divide-surface-container-high">
          {available.map((l) => {
            const main = l === languages.main;
            const on = offered.includes(l);
            return (
              <li key={l} className="flex items-center justify-between gap-md py-sm">
                <span className="min-w-0">
                  <span className="block font-semibold text-on-surface">{languageLabel(l)}</span>
                  <span className="block text-caption text-on-surface-variant">
                    {main
                      ? t("mainHint")
                      : BASE_LANGUAGES.includes(l as never)
                        ? t("baseHint")
                        : t("extraHint")}
                  </span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={t("offer", { language: languageLabel(l) })}
                  disabled={main || pending}
                  onClick={() => setOffered((o) => (on ? o.filter((x) => x !== l) : [...o, l]))}
                  className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${on ? "bg-primary" : "bg-surface-container-highest"}`}
                >
                  <span
                    className={`h-5 w-5 rounded-full bg-surface-container-lowest shadow-sm transition-transform ${on ? "translate-x-6 rtl:-translate-x-6" : "translate-x-1 rtl:-translate-x-1"}`}
                  />
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-md flex justify-end">
          <button
            type="button"
            disabled={!dirty || pending}
            onClick={() => run(() => setLanguagesAction(slug, offered))}
            className="inline-flex items-center gap-xs rounded-xl bg-primary px-lg py-sm font-semibold text-on-primary shadow-button-warm hover:bg-primary-container disabled:opacity-60"
          >
            <Icon
              name={pending ? "progress_activity" : "check"}
              className={`text-icon-lg ${pending ? "animate-spin" : ""}`}
            />
            {dirty ? t("saveLanguages") : t("saved")}
          </button>
        </div>
      </Section>

      <Section title={t("requestTitle")} icon="add_comment" description={t("requestBody")}>
        {requestable.length ? (
          <form
            className="flex flex-col gap-md"
            onSubmit={(e) => {
              e.preventDefault();
              run(
                () => requestLanguageAction(slug, locale, note),
                () => setNote(""),
              );
            }}
          >
            <label className="flex flex-col gap-xs text-body-sm font-semibold text-on-surface">
              {t("language")}
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
                className="rounded-lg border border-outline-variant bg-transparent px-sm py-3.5 font-normal"
              >
                {requestable.map((l) => (
                  <option key={l} value={l}>
                    {languageLabel(l)}
                  </option>
                ))}
              </select>
            </label>
            <TextAreaField
              id="language-note"
              label={t("why")}
              rows={2}
              maxLength={300}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              hint={t("whyHint")}
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={pending || !locale}
                className="inline-flex items-center gap-xs rounded-xl border border-outline-variant px-lg py-sm font-semibold text-primary hover:bg-secondary-container disabled:opacity-60"
              >
                <Icon name="send" className="text-icon-lg" flipRtl /> {t("send")}
              </button>
            </div>
          </form>
        ) : (
          <p className="text-body-sm text-on-surface-variant">{t("allRequested")}</p>
        )}

        {languages.requests.length ? (
          <ul className="mt-lg flex flex-col gap-sm">
            {languages.requests.map((r) => (
              <li
                key={r.id}
                className="flex flex-col gap-xs rounded-lg bg-surface-container-low p-md text-body-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-sm">
                  <span className="font-semibold text-on-surface">{languageLabel(r.locale)}</span>
                  <span
                    className={`rounded-full px-sm py-xs text-caption font-semibold ${STATUS[r.status]}`}
                  >
                    {t(r.status)}
                  </span>
                </div>
                <span className="text-caption text-on-surface-variant">
                  {t("requested", { date: dates[r.id] })}
                  {r.note ? ` · “${r.note}”` : ""}
                </span>
                {r.decisionNote ? (
                  <span className="text-caption text-on-surface">
                    {t("serbiReply", { note: r.decisionNote })}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </Section>
    </div>
  );
}
