"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTenantOwner } from "@/lib/auth/guards";
import { tenantDashboard } from "@/lib/auth/routes";
import { inputField, isDataError } from "@/lib/data/errors";
import { serverApi } from "@/lib/data/server-api";
import { msg } from "@/i18n/msg";
import { cleanI18n } from "@/lib/i18n/languages";
import { categoryI18nSchema, categorySchema, currencyDigits, itemSchema } from "@/lib/menu/schema";
import { tagFormSchema } from "@/lib/menu/tags";
import { zodErrors } from "@/lib/settings/schema";

export type MenuResult =
  | { ok: true; id?: string; message?: string }
  | { ok: false; message: string; errors?: Record<string, string> };

const refresh = (slug: string) => revalidatePath(`${tenantDashboard(slug)}/menu`);

/** Message per invalid field (the menu schema is shared with cafe-app: its texts stay English). */
const FIELD_LABELS: Record<string, string> = {
  name: msg("menuName"),
  price: msg("menuPrice"),
  description: msg("menuDescription"),
  image: msg("menuPhoto"),
  image_path: msg("menuPhoto"),
  i18n: msg("menuTranslations"),
  category_id: msg("menuCategory"),
  tags: msg("menuTags"),
  tag_ids: msg("menuTags"),
  icon: msg("menuTagIcon"),
  options: msg("menuOptions"),
};

/** Schema errors → translatable messages per field (price: with an example in the café's currency). */
function fieldErrors(error: z.ZodError, currency?: string): Record<string, string> {
  return Object.fromEntries(
    Object.keys(zodErrors(error)).map((f) => [
      f,
      f === "price" && currency
        ? msg("menuPriceFormat", { example: (4.5).toFixed(currencyDigits(currency)) })
        : (FIELD_LABELS[f] ?? msg("checkValue")),
    ]),
  );
}

function failure(e: unknown, fallback: string, conflictField?: string): MenuResult {
  const field = inputField(e);
  if (field === "limit") return { ok: false, message: msg("limitReached") };
  if (field)
    return {
      ok: false,
      message: FIELD_LABELS[field] ?? msg("checkForm"),
      errors: { [field]: FIELD_LABELS[field] ?? msg("checkValue") },
    };
  if (isDataError(e, "conflict"))
    return {
      ok: false,
      message: fallback,
      errors: conflictField ? { [conflictField]: fallback } : undefined,
    };
  if (isDataError(e, "in_use")) return { ok: false, message: msg("categoryNotEmpty") };
  if (isDataError(e, "name_taken"))
    return { ok: false, message: msg("tagNameTaken"), errors: { name: msg("tagNameTaken") } };
  if (isDataError(e, "stale_list")) return { ok: false, message: msg("changedMeanwhile") };
  if (isDataError(e, "invalid_state")) return { ok: false, message: msg("templateOnlyEmpty") };
  if (isDataError(e)) return { ok: false, message: msg("somethingWrong") };
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
    return { ok: false, message: msg("menuName"), errors: fieldErrors(parsed.error) };
  const tr = i18n === undefined ? undefined : categoryI18nSchema.safeParse(i18n);
  if (tr && !tr.success) return { ok: false, message: msg("menuTranslations") };
  try {
    const cid = await serverApi().menu.saveCategory(
      slug,
      id,
      parsed.data.name,
      isVisible,
      tr?.success ? (cleanI18n(tr.data) as Record<string, Record<string, string>>) : undefined,
    );
    refresh(slug);
    return { ok: true, id: cid, message: id ? msg("categorySaved") : msg("categoryAdded") };
  } catch (e) {
    return failure(e, msg("categoryNameTaken"), "name");
  }
}

export async function deleteCategoryAction(slug: string, id: string): Promise<MenuResult> {
  await requireTenantOwner(slug);
  try {
    await serverApi().menu.deleteCategory(slug, id);
    refresh(slug);
    return { ok: true, message: msg("categoryDeleted") };
  } catch (e) {
    return failure(e, msg("categoryDeleteFailed"));
  }
}

const ids = z.array(z.uuid()).max(500);

export async function reorderCategoriesAction(slug: string, order: unknown): Promise<MenuResult> {
  await requireTenantOwner(slug);
  const parsed = ids.safeParse(order);
  if (!parsed.success) return { ok: false, message: msg("orderFailed") };
  try {
    await serverApi().menu.reorderCategories(slug, parsed.data);
    refresh(slug);
    return { ok: true };
  } catch (e) {
    return failure(e, msg("orderFailed"));
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
    return { ok: false, message: msg("orderFailed") };
  try {
    await serverApi().menu.reorderItems(slug, categoryId, parsed.data);
    refresh(slug);
    return { ok: true };
  } catch (e) {
    return failure(e, msg("orderFailed"));
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
  if (!cafe) return { ok: false, message: msg("cafeNotFound") };
  const parsed = itemSchema(cafe.currency).safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      message: msg("fieldsNeedAttention"),
      errors: fieldErrors(parsed.error, cafe.currency),
    };
  const d = parsed.data;
  try {
    const itemId = await api.menu.saveItem(slug, id, {
      categoryId: d.category_id,
      name: d.name,
      description: d.description,
      price: d.price,
      image: d.image_path ? { path: d.image_path, alt: d.image_alt } : null,
      tagIds: d.tag_ids,
      isAvailable: d.is_available,
      isVisible: d.is_visible,
      isFeatured: d.is_featured,
      i18n: cleanI18n(d.i18n) as Record<string, Record<string, string>>,
      options: d.options.map((g) => ({
        ...g,
        i18n: cleanI18n(g.i18n) as Record<string, { name: string }>,
        choices: g.choices.map((c) => ({
          ...c,
          i18n: cleanI18n(c.i18n) as Record<string, { name: string }>,
        })),
      })),
    });
    refresh(slug);
    return {
      ok: true,
      id: itemId,
      message: id ? msg("itemSaved") : msg("itemAdded", { name: d.name }),
    };
  } catch (e) {
    return failure(e, msg("itemSaveFailed"));
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
    return { ok: true, message: available ? msg("itemBackOnMenu") : msg("itemSoldOut") };
  } catch (e) {
    return failure(e, msg("itemUpdateFailed"));
  }
}

export async function deleteItemAction(slug: string, id: string): Promise<MenuResult> {
  await requireTenantOwner(slug);
  try {
    await serverApi().menu.deleteItem(slug, id);
    refresh(slug);
    return { ok: true, message: msg("itemDeleted") };
  } catch (e) {
    return failure(e, msg("itemDeleteFailed"));
  }
}

export async function applyTemplateAction(slug: string): Promise<MenuResult> {
  await requireTenantOwner(slug);
  try {
    await serverApi().menu.applyTemplate(slug);
    refresh(slug);
    return { ok: true, message: msg("templateAdded") };
  } catch (e) {
    return failure(e, msg("templateFailed"));
  }
}

/* ── Tags ── */

/** Create (id null) or update a tag; returns its id (the item form selects a new tag at once). */
export async function saveTagAction(
  slug: string,
  id: string | null,
  input: unknown,
): Promise<MenuResult> {
  await requireTenantOwner(slug);
  const parsed = tagFormSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: msg("fieldsNeedAttention"), errors: fieldErrors(parsed.error) };
  const d = parsed.data;
  if (!id && !d.name)
    return { ok: false, message: msg("menuName"), errors: { name: msg("menuName") } };
  try {
    const tagId = await serverApi().menu.saveTag(slug, id, {
      name: d.name,
      icon: d.icon,
      isVisible: d.isVisible,
      i18n: cleanI18n(d.i18n) as Record<string, Record<string, string>>,
    });
    refresh(slug);
    return {
      ok: true,
      id: tagId,
      message: id ? msg("tagSaved") : msg("tagAdded", { name: d.name }),
    };
  } catch (e) {
    return failure(e, msg("tagSaveFailed"));
  }
}

export async function deleteTagAction(slug: string, id: string): Promise<MenuResult> {
  await requireTenantOwner(slug);
  if (!z.uuid().safeParse(id).success) return { ok: false, message: msg("checkForm") };
  try {
    const n = await serverApi().menu.deleteTag(slug, id);
    refresh(slug);
    return { ok: true, message: msg("tagDeleted", { count: n }) };
  } catch (e) {
    return failure(e, msg("tagDeleteFailed"));
  }
}

export async function reorderTagsAction(slug: string, order: unknown): Promise<MenuResult> {
  await requireTenantOwner(slug);
  const parsed = z.array(z.uuid()).max(100).safeParse(order);
  if (!parsed.success) return { ok: false, message: msg("orderFailed") };
  try {
    await serverApi().menu.reorderTags(slug, parsed.data);
    refresh(slug);
    return { ok: true };
  } catch (e) {
    return failure(e, msg("orderFailed"));
  }
}
