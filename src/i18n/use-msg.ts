"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { parseMsg } from "./msg";

/** Translates a message from an action/schema (see msg.ts); plain text is returned as it is. */
export function useMsg() {
  const t = useTranslations("msg");
  return useCallback(
    (s: string | undefined | null): string => {
      if (!s) return "";
      const m = parseMsg(s);
      if (!m) return s;
      return t.has(m.key) ? t(m.key, m.values) : s;
    },
    [t],
  );
}
