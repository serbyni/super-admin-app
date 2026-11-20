"use server";

import { cookies } from "next/headers";
import { serverApi } from "@/lib/data/server-api";
import { UI_LANG_COOKIE, UI_LANG_COOKIE_MAX_AGE, isUiLocale } from "./config";

/**
 * Language picked on the sign-in / registration pages: remembered in a cookie, and saved on the
 * owner account when someone is signed in (pending owners, onboarding).
 */
export async function setUiLanguageCookieAction(locale: string): Promise<void> {
  if (!isUiLocale(locale)) return;
  (await cookies()).set(UI_LANG_COOKIE, locale, {
    path: "/",
    maxAge: UI_LANG_COOKIE_MAX_AGE,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  const api = serverApi();
  if (await api.owners.me().catch(() => null)) await api.owners.setUiLocale(locale).catch(() => {});
}
