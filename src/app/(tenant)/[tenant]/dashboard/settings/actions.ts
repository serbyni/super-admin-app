"use server";

import { revalidatePath } from "next/cache";
import { requireTenantOwner } from "@/lib/auth/guards";
import { tenantDashboard } from "@/lib/auth/routes";
import { inputField, isDataError } from "@/lib/data/errors";
import { serverApi } from "@/lib/data/server-api";
import { msg } from "@/i18n/msg";
import { cafeSettingsSchema, zodErrors, type FormState } from "@/lib/settings/schema";

const values = (f: FormData) => Object.fromEntries(f) as Record<string, string>;
const done = (prev: FormState, message: string): FormState => ({
  ok: true,
  saved: (prev.saved ?? 0) + 1,
  message,
});

/** Café tab. Only the café's owner (checked here and again in update_my_cafe). */
export async function saveCafeAction(
  slug: string,
  prev: FormState,
  form: FormData,
): Promise<FormState> {
  await requireTenantOwner(slug);
  const parsed = cafeSettingsSchema.safeParse(values(form));
  if (!parsed.success) return { errors: zodErrors(parsed.error) };
  const d = parsed.data;
  try {
    await serverApi().cafes.updateMine(slug, {
      name: d.name,
      countryCode: d.country_code,
      city: d.city,
      address: d.address || undefined,
      currency: d.currency,
      timezone: d.timezone,
      locale: d.locale,
      seed: d.seed,
      phone: d.phone,
      email: d.email,
      facebook: d.facebook,
      instagram: d.instagram,
    });
  } catch (e) {
    const field = inputField(e);
    if (field) return { errors: { [field]: msg("checkValue") } };
    if (isDataError(e)) return { errors: { form: msg("saveFailed") } };
    throw e;
  }
  revalidatePath(tenantDashboard(slug), "layout");
  return done(prev, msg("cafeSaved"));
}

/* ── Languages tab ── */

export type LanguagesResult = { ok: true; message: string } | { ok: false; message: string };

/** Languages the café offers (any available one; the main language is always kept). */
export async function setLanguagesAction(
  slug: string,
  locales: string[],
): Promise<LanguagesResult> {
  await requireTenantOwner(slug);
  if (
    !Array.isArray(locales) ||
    locales.some((l) => typeof l !== "string" || !/^[a-z]{2}$/.test(l))
  )
    return { ok: false, message: msg("languagesInvalid") };
  try {
    await serverApi().languages.setOffered(slug, locales);
  } catch (e) {
    if (isDataError(e)) return { ok: false, message: msg("languagesSaveFailed") };
    throw e;
  }
  revalidatePath(tenantDashboard(slug), "layout");
  return { ok: true, message: msg("languagesSaved") };
}

/** Asks Serbi to add an extra language to the café (admins are notified). */
export async function requestLanguageAction(
  slug: string,
  locale: string,
  note: string,
): Promise<LanguagesResult> {
  await requireTenantOwner(slug);
  if (!/^[a-z]{2}$/.test(locale) || note.length > 300)
    return { ok: false, message: msg("requestInvalid") };
  try {
    await serverApi().languages.request(slug, locale, note.trim());
  } catch (e) {
    if (isDataError(e, "conflict")) return { ok: false, message: msg("requestDuplicate") };
    if (isDataError(e)) return { ok: false, message: msg("requestFailed") };
    throw e;
  }
  revalidatePath(tenantDashboard(slug), "layout");
  return { ok: true, message: msg("requestSent") };
}
