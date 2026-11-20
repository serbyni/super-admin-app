"use client";

import { useLocale } from "next-intl";
import { useCallback } from "react";
import { languageLabel } from "@/lib/i18n/languages";

/** languageLabel() in the reader's interface language. */
export function useLanguageLabel() {
  const ui = useLocale();
  return useCallback((code: string) => languageLabel(code, ui), [ui]);
}
