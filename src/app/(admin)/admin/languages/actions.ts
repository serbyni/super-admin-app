"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { isDataError } from "@/lib/data/errors";
import { kickEmailDispatch } from "@/lib/data/kick-email";
import { serverApi } from "@/lib/data/server-api";

export type AdminLanguageResult = { ok: true; message: string } | { ok: false; message: string };

/** Approve (language added to the café and offered) or decline; the owner is notified. */
export async function decideLanguageRequestAction(
  id: string,
  approve: boolean,
  note: string,
): Promise<AdminLanguageResult> {
  await requireAdmin();
  if (!/^[0-9a-f-]{36}$/.test(id) || note.length > 300)
    return { ok: false, message: "Please check the note." };
  try {
    await serverApi().languages.adminDecide(id, approve, note.trim());
  } catch (e) {
    if (isDataError(e, "invalid_status"))
      return { ok: false, message: "This request was already decided." };
    if (isDataError(e))
      return { ok: false, message: "Could not save the decision. Please try again." };
    throw e;
  }
  kickEmailDispatch(); // language_request_decided
  revalidatePath("/admin", "layout");
  return {
    ok: true,
    message: approve ? "Approved — the owner is notified" : "Declined — the owner is notified",
  };
}

/** Sets a café's extra languages (removed ones are no longer offered by the café). */
export async function setCafeExtraLanguagesAction(
  slug: string,
  locales: string[],
): Promise<AdminLanguageResult> {
  await requireAdmin();
  if (!Array.isArray(locales) || locales.some((l) => !/^[a-z]{2}$/.test(l)))
    return { ok: false, message: "Please check the languages." };
  try {
    await serverApi().languages.adminSetExtras(slug, locales);
  } catch (e) {
    if (isDataError(e))
      return { ok: false, message: "Could not save the languages. Please try again." };
    throw e;
  }
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Extra languages saved" };
}
