import "server-only";
import { cookies, headers } from "next/headers";
import { setRequestLocale } from "next-intl/server";
import { cache } from "react";
import { serverApi } from "@/lib/data/server-api";
import { UI_LANG_COOKIE, pickUiLocale, type UiLocale } from "./config";

/** The owner-side language of this request (account choice → cookie → browser → English). */
export const ownerLocale = cache(async (): Promise<UiLocale> => {
  const [jar, h] = await Promise.all([cookies(), headers()]);
  // Signed-in owners: their saved choice (no session cookie → no database call).
  const signedIn = jar
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));
  const me = signedIn
    ? await serverApi()
        .owners.me()
        .catch(() => null)
    : null;
  return pickUiLocale({
    saved: me?.locale ?? jar.get(UI_LANG_COOKIE)?.value,
    acceptLanguage: h.get("accept-language"),
  });
});

/** Registers the owner's language for next-intl (call at the top of owner layouts and pages). */
export async function applyOwnerLocale(): Promise<UiLocale> {
  const locale = await ownerLocale();
  setRequestLocale(locale);
  return locale;
}
