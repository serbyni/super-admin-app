"use client";

import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import en from "../../../messages/en.json";
import { PLATFORM_TIME_ZONE } from "@/config/locale";

/**
 * English texts for client components outside the owner pages (admin console, static pages).
 * A client provider: it reads nothing from the request, so the root layout stays static.
 * Owner layouts nest their own language (OwnerIntl).
 */
export function EnglishIntl({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={en} timeZone={PLATFORM_TIME_ZONE}>
      {children}
    </NextIntlClientProvider>
  );
}
