"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { businessTypeFormSchema } from "@/lib/business-types/schema";
import {
  adminDeleteBusinessType,
  adminReorderBusinessTypes,
  adminSaveBusinessType,
} from "@/lib/data/business-types";
import { isDataError, type DataErrorCode } from "@/lib/data/errors";

export type BusinessTypeFormState = {
  errors?: Partial<Record<string, string>>;
  values?: Record<string, string>;
};

function firstErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) out[String(i.path[0] ?? "form")] ??= i.message;
  return out;
}

/** Rethrows anything that is not a DataError (e.g. Next redirects). */
function dataErrorCode(e: unknown): DataErrorCode {
  if (isDataError(e)) return e.code;
  throw e;
}

export async function saveBusinessType(
  _prev: BusinessTypeFormState,
  formData: FormData,
): Promise<BusinessTypeFormState> {
  await requireAdmin();
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = businessTypeFormSchema.safeParse(raw);
  if (!parsed.success) return { errors: firstErrors(parsed.error.issues), values: raw };

  const d = parsed.data;
  try {
    await adminSaveBusinessType({
      id: d.id,
      slug: d.slug,
      name: {
        en: d.name_en,
        ...(d.name_fr && { fr: d.name_fr }),
        ...(d.name_ar && { ar: d.name_ar }),
      },
      icon: d.icon,
      isActive: d.is_active,
    });
  } catch (e) {
    const code = dataErrorCode(e);
    const errors =
      code === "conflict"
        ? { slug: "This code is already used by another business type" }
        : code === "forbidden"
          ? { form: "You are not allowed to do this." }
          : { form: "Could not save. Please try again." };
    return { errors, values: raw };
  }
  redirect(`/admin/business?saved=${encodeURIComponent(d.slug)}`);
}

export type DeleteState = { error?: string };

export async function deleteBusinessType(
  _prev: DeleteState,
  formData: FormData,
): Promise<DeleteState> {
  await requireAdmin();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Invalid business type." };
  try {
    await adminDeleteBusinessType(id.data);
  } catch (e) {
    return {
      error:
        dataErrorCode(e) === "in_use"
          ? "In use by café owners — deactivate it instead."
          : "Could not delete. Please try again.",
    };
  }
  redirect("/admin/business?deleted=1");
}

export type ReorderResult = { ok: true } | { ok: false; error: string };

/** Persist the full drag-and-drop order (every id, top to bottom). */
export async function reorderBusinessTypes(ids: string[]): Promise<ReorderResult> {
  await requireAdmin();
  const parsed = z.array(z.uuid()).min(1).max(500).safeParse(ids);
  if (!parsed.success) return { ok: false, error: "Invalid order." };
  try {
    await adminReorderBusinessTypes(parsed.data);
  } catch (e) {
    return {
      ok: false,
      error:
        dataErrorCode(e) === "stale_list"
          ? "The list changed in the meantime. Reload the page and try again."
          : "Could not save the new order. Please try again.",
    };
  }
  return { ok: true };
}
