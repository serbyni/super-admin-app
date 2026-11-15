"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { BUSINESS_TYPES_TAG } from "@/lib/business-types/data";
import { z } from "zod";
import { businessTypeFormSchema } from "@/lib/business-types/schema";

export type BusinessTypeFormState = {
  errors?: Partial<Record<string, string>>;
  values?: Record<string, string>;
};

function firstErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) out[String(i.path[0] ?? "form")] ??= i.message;
  return out;
}

export async function saveBusinessType(
  _prev: BusinessTypeFormState,
  formData: FormData,
): Promise<BusinessTypeFormState> {
  const { supabase } = await requireAdmin();
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = businessTypeFormSchema.safeParse(raw);
  if (!parsed.success) return { errors: firstErrors(parsed.error.issues), values: raw };

  const d = parsed.data;
  const { error } = await supabase.rpc("admin_save_business_type", {
    p_id: d.id,
    p_slug: d.slug,
    p_name: {
      en: d.name_en,
      ...(d.name_fr && { fr: d.name_fr }),
      ...(d.name_ar && { ar: d.name_ar }),
    },
    p_icon: d.icon,
    p_is_active: d.is_active,
  });
  if (error) {
    const message =
      error.code === "23505"
        ? { slug: "This code is already used by another business type" }
        : error.message.includes("forbidden")
          ? { form: "You are not allowed to do this." }
          : { form: "Could not save. Please try again." };
    return { errors: message, values: raw };
  }
  updateTag(BUSINESS_TYPES_TAG);
  redirect(`/admin/business?saved=${encodeURIComponent(d.slug)}`);
}

export type DeleteState = { error?: string };

export async function deleteBusinessType(
  _prev: DeleteState,
  formData: FormData,
): Promise<DeleteState> {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const { error } = await supabase.rpc("admin_delete_business_type", { p_id: id });
  if (error) {
    return {
      error: error.message.includes("in_use")
        ? "In use by café owners — deactivate it instead."
        : "Could not delete. Please try again.",
    };
  }
  updateTag(BUSINESS_TYPES_TAG);
  redirect("/admin/business?deleted=1");
}

export type ReorderResult = { ok: true } | { ok: false; error: string };

/** Persist the full drag-and-drop order (every id, top to bottom). */
export async function reorderBusinessTypes(ids: string[]): Promise<ReorderResult> {
  const { supabase } = await requireAdmin();
  const parsed = z.array(z.uuid()).min(1).max(500).safeParse(ids);
  if (!parsed.success) return { ok: false, error: "Invalid order." };
  const { error } = await supabase.rpc("admin_reorder_business_types", { p_ids: parsed.data });
  if (error) {
    return {
      ok: false,
      error: error.message.includes("stale_list")
        ? "The list changed in the meantime. Reload the page and try again."
        : "Could not save the new order. Please try again.",
    };
  }
  updateTag(BUSINESS_TYPES_TAG);
  return { ok: true };
}
