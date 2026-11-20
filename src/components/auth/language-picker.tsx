"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { UI_LANGUAGE_NAMES, UI_LOCALES } from "@/i18n/config";
import { setUiLanguageCookieAction } from "@/i18n/actions";

/** Globe button of the sign-in pages: EN / FR / AR (names in their own language). */
export function LanguagePicker() {
  const t = useTranslations("authShell");
  const current = useLocale();
  const router = useRouter();
  const ref = useRef<HTMLDetailsElement>(null);
  const [pending, start] = useTransition();
  return (
    <details ref={ref} className="relative">
      <summary
        aria-label={t("language")}
        title={t("language")}
        className="no-marker flex cursor-pointer list-none items-center gap-xs rounded-full px-sm py-xs font-label-sm text-label-sm tracking-wider text-on-surface-variant uppercase hover:bg-surface-container"
      >
        <Icon
          name={pending ? "progress_activity" : "translate"}
          className={`text-icon-sm ${pending ? "animate-spin" : ""}`}
        />
        {current}
      </summary>
      <ul className="absolute end-0 z-50 mt-xs w-40 overflow-hidden rounded-xl border border-surface-container-high bg-surface-container-lowest py-xs shadow-card-warm">
        {UI_LOCALES.map((l) => (
          <li key={l}>
            <button
              type="button"
              lang={l}
              aria-current={l === current ? "true" : undefined}
              onClick={() => {
                if (ref.current) ref.current.open = false;
                start(async () => {
                  await setUiLanguageCookieAction(l);
                  router.refresh();
                });
              }}
              className={`flex w-full items-center justify-between px-md py-sm text-start text-body-sm hover:bg-surface-container-low ${
                l === current ? "font-bold text-primary" : "text-on-surface"
              }`}
            >
              {UI_LANGUAGE_NAMES[l]}
              {l === current ? <Icon name="check" className="text-icon-md" /> : null}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
