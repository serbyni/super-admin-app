"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Section } from "@/components/settings/form-kit";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { msg } from "@/i18n/msg";
import { useMsg } from "@/i18n/use-msg";
import { defaultHours, type OpeningHours } from "@/lib/cafes/hours";
import { setOpeningHoursAction } from "./actions";

const timeBox =
  "rounded-lg border border-outline-variant bg-transparent px-sm py-xs text-body-sm text-on-surface";

/**
 * Settings → Opening hours: 7 days (closed switch, opening / closing time), or no fixed hours.
 * Saved directly — ordering and the website footer use them at once.
 */
export function HoursTab({ slug, hours }: { slug: string; hours: OpeningHours | null }) {
  const t = useTranslations("hoursTab");
  const m = useMsg();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [fixed, setFixed] = useState(hours !== null);
  const [days, setDays] = useState<OpeningHours>(hours ?? defaultHours());
  const names = t("days").split("|");
  const dirty =
    fixed !== (hours !== null) || (fixed && JSON.stringify(days) !== JSON.stringify(hours));
  const badDay = fixed ? days.findIndex((d) => !d.closed && d.open === d.close) : -1;

  const setDay = (i: number, patch: Partial<OpeningHours[number]>) =>
    setDays((ds) => ds.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  const save = () =>
    start(async () => {
      const r = await setOpeningHoursAction(slug, fixed ? days : null);
      toast.show({ variant: r.ok ? "success" : "error", title: m(r.message) });
    });

  return (
    <Section title={t("title")} icon="schedule" description={t("body")}>
      <div className="flex flex-col gap-md">
        <div role="radiogroup" aria-label={t("title")} className="flex flex-wrap gap-sm">
          {(
            [
              [true, t("fixed")],
              [false, t("always")],
            ] as const
          ).map(([value, label]) => (
            <label
              key={String(value)}
              className={`flex cursor-pointer items-center gap-xs rounded-xl border px-md py-sm text-body-sm font-semibold ${
                fixed === value
                  ? "border-primary bg-secondary-container text-on-secondary-container"
                  : "border-outline-variant text-on-surface-variant"
              }`}
            >
              <input
                type="radio"
                name="hours-mode"
                checked={fixed === value}
                onChange={() => setFixed(value)}
                className="h-4 w-4 accent-primary"
              />
              {label}
            </label>
          ))}
        </div>

        {fixed ? (
          <div className="flex flex-col divide-y divide-surface-container-high">
            {days.map((d, i) => (
              <div key={i} className="grid grid-cols-2 items-center gap-sm py-sm sm:grid-cols-4">
                <span className="text-body-sm font-semibold text-on-surface">{names[i]}</span>
                <label className="flex items-center gap-xs text-body-sm text-on-surface-variant">
                  <input
                    type="checkbox"
                    checked={!d.closed}
                    onChange={(e) => setDay(i, { closed: !e.target.checked })}
                    className="h-4 w-4 accent-primary"
                  />
                  {t("open")}
                </label>
                {d.closed ? (
                  <span className="text-body-sm text-on-surface-variant sm:col-span-2">
                    {t("closed")}
                  </span>
                ) : (
                  <div className="col-span-2 flex flex-wrap items-center gap-xs">
                    <input
                      type="time"
                      aria-label={t("opens", { day: names[i] })}
                      value={d.open}
                      onChange={(e) => setDay(i, { open: e.target.value })}
                      className={timeBox}
                    />
                    <span aria-hidden="true">–</span>
                    <input
                      type="time"
                      aria-label={t("closes", { day: names[i] })}
                      value={d.close}
                      onChange={(e) => setDay(i, { close: e.target.value })}
                      aria-invalid={badDay === i || undefined}
                      className={timeBox}
                    />
                    {d.close < d.open ? (
                      <span className="text-caption text-on-surface-variant">{t("overnight")}</span>
                    ) : null}
                  </div>
                )}
              </div>
            ))}
            <div className="pt-sm">
              <button
                type="button"
                onClick={() => setDays((ds) => ds.map(() => ({ ...ds[0] })))}
                className="inline-flex items-center gap-xs rounded-lg px-sm py-xs text-body-sm font-semibold text-primary hover:bg-secondary-container"
              >
                <Icon name="content_copy" className="text-icon-md" />
                {t("copyMonday")}
              </button>
            </div>
          </div>
        ) : (
          <p className="rounded-lg bg-surface-container-low p-md text-body-sm text-on-surface-variant">
            {t("alwaysHint")}
          </p>
        )}

        {badDay >= 0 ? (
          <p role="alert" className="text-body-sm text-error">
            {m(msg("hoursInvalid"))}
          </p>
        ) : null}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={save}
            disabled={pending || !dirty || badDay >= 0}
            className="inline-flex items-center gap-xs rounded-xl bg-primary px-lg py-sm font-semibold text-on-primary shadow-button-warm hover:bg-primary-container disabled:opacity-60"
          >
            {pending ? (
              <Icon name="progress_activity" className="animate-spin text-icon-md" />
            ) : null}
            {pending ? t("saving") : t("save")}
          </button>
        </div>
      </div>
    </Section>
  );
}
