"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTenantOwner } from "@/lib/auth/guards";
import { tenantDashboard } from "@/lib/auth/routes";
import { inputField, isDataError } from "@/lib/data/errors";
import { serverApi } from "@/lib/data/server-api";
import { cleanI18n } from "@/lib/i18n/languages";
import { categoryI18nSchema, categorySchema, itemSchema } from "@/lib/menu/schema";
import { zodErrors } from "@/lib/settings/schema";

export type MenuResult =
  | { ok: true; id?: string; message?: string }
  | { ok: false; message: string; errors?: Record<string, string> };

const refresh = (slug: string) => revalidatePath(`${tenantDashboard(slug)}/menu`);

const FIELD_LABELS: Record<string, string> = {
  name: "Please check the name.",
  price: "Please check the price.",
  description: "Please check the description.",
  image: "Upload the photo again.",
  i18n: "Please check the translations.",
  category_id: "Choose a category.",
  tags: "Please check the tags.",
};

function failure(e: unknown, fallback: string, conflictField?: string): MenuResult {
  const field = inputField(e);
  if (field === "limit") return { ok: false, message: "You reached the limit for this café." };
  if (field)
    return {
      ok: false,
      message: FIELD_LABELS[field] ?? "Please check the form.",
      errors: { [field]: FIELD_LABELS[field] ?? "Please check this value." },
    };
  if (isDataError(e, "conflict"))
    return {
      ok: false,
      message: fallback,
      errors: conflictField ? { [conflictField]: fallback } : undefined,
    };
  if (isDataError(e, "in_use"))
    return { ok: false, message: "Move or delete the items of this category first." };
  if (isDataError(e, "stale_list"))
    return { ok: false, message: "The menu changed meanwhile. Reload the page." };
  if (isDataError(e, "invalid_state"))
    return { ok: false, message: "The template is only for an empty menu." };
  if (isDataError(e)) return { ok: false, message: "Something went wrong. Please try again." };
  throw e;
}

export async function saveCategoryAction(
  slug: string,
  id: string | null,
  name: string,
  isVisible: boolean,
  i18n?: unknown,
): Promise<MenuResult> {
  await requireTenantOwner(slug);
  const parsed = categorySchema.safeParse({ name });
  if (!parsed.success)
    return { ok: false, message: "Please check the name.", errors: zodErrors(parsed.error) };
  const tr = i18n === undefined ? undefined : categoryI18nSchema.safeParse(i18n);
  if (tr && !tr.success) return { ok: false, message: "Please check the translations." };
  try {
    const cid = await serverApi().menu.saveCategory(
      slug,
      id,
      parsed.data.name,
      isVisible,
      tr?.success ? (cleanI18n(tr.data) as Record<string, Record<string, string>>) : undefined,
    );
    refresh(slug);
    return { ok: true, id: cid, message: id ? "Category saved" : "Category added" };
  } catch (e) {
    return failure(e, "Another category has this name.", "name");
  }
}

export async function deleteCategoryAction(slug: string, id: string): Promise<MenuResult> {
  await requireTenantOwner(slug);
  try {
    await serverApi().menu.deleteCategory(slug, id);
    refresh(slug);
    return { ok: true, message: "Category deleted" };
  } catch (e) {
    return failure(e, "Could not delete the category.");
  }
}

const ids = z.array(z.uuid()).max(500);

export async function reorderCategoriesAction(slug: string, order: unknown): Promise<MenuResult> {
  await requireTenantOwner(slug);
  const parsed = ids.safeParse(order);
  if (!parsed.success) return { ok: false, message: "Could not save the order." };
  try {
    await serverApi().menu.reorderCategories(slug, parsed.data);
    refresh(slug);
    return { ok: true };
  } catch (e) {
    return failure(e, "Could not save the order.");
  }
}

export async function reorderItemsAction(
  slug: string,
  categoryId: string,
  order: unknown,
): Promise<MenuResult> {
  await requireTenantOwner(slug);
  const parsed = ids.safeParse(order);
  if (!parsed.success || !z.uuid().safeParse(categoryId).success)
    return { ok: false, message: "Could not save the order." };
  try {
    await serverApi().menu.reorderItems(slug, categoryId, parsed.data);
    refresh(slug);
    return { ok: true };
  } catch (e) {
    return failure(e, "Could not save the order.");
  }
}

/** Item form. The currency comes from the café (server side), never from the browser. */
export async function saveItemAction(
  slug: string,
  id: string | null,
  input: unknown,
): Promise<MenuResult> {
  await requireTenantOwner(slug);
  const api = serverApi();
  const cafe = await api.cafes.mine(slug);
  if (!cafe) return { ok: false, message: "Café not found." };
  const parsed = itemSchema(cafe.currency).safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      message: "Some fields need your attention.",
      errors: zodErrors(parsed.error),
    };
  const d = parsed.data;
  try {
    const itemId = await api.menu.saveItem(slug, id, {
      categoryId: d.category_id,
      name: d.name,
      description: d.description,
      price: d.price,
      image: d.image_path ? { path: d.image_path, alt: d.image_alt } : null,
      tags: d.tags,
      isAvailable: d.is_available,
      isVisible: d.is_visible,
      isFeatured: d.is_featured,
      i18n: cleanI18n(d.i18n) as Record<string, Record<string, string>>,
    });
    refresh(slug);
    return { ok: true, id: itemId, message: id ? "Item saved" : `${d.name} added` };
  } catch (e) {
    return failure(e, "Could not save the item.");
  }
}

export async function setAvailableAction(
  slug: string,
  id: string,
  available: boolean,
): Promise<MenuResult> {
  await requireTenantOwner(slug);
  try {
    await serverApi().menu.setAvailable(slug, id, available);
    refresh(slug);
    return { ok: true, message: available ? "Back on the menu" : "Marked as sold out" };
  } catch (e) {
    return failure(e, "Could not update the item.");
  }
}

export async function deleteItemAction(slug: string, id: string): Promise<MenuResult> {
  await requireTenantOwner(slug);
  try {
    await serverApi().menu.deleteItem(slug, id);
    refresh(slug);
    return { ok: true, message: "Item deleted" };
  } catch (e) {
    return failure(e, "Could not delete the item.");
  }
}

export async function applyTemplateAction(slug: string): Promise<MenuResult> {
  await requireTenantOwner(slug);
  try {
    await serverApi().menu.applyTemplate(slug);
    refresh(slug);
    return { ok: true, message: "Starter menu added — set your prices to show items" };
  } catch (e) {
    return failure(e, "Could not add the starter menu.");
  }
}
