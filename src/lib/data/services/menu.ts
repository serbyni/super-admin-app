import "server-only";
import type { Json } from "@/lib/supabase/database.types";
import { menuSchema, type Menu, type MenuTag } from "@/lib/menu/schema";
import { unwrap } from "../errors";
import type { LazyDb } from "../types";

export type MenuItemInput = {
  categoryId: string;
  name: string;
  description: string;
  price: number | null;
  image: { path: string; alt: string } | null;
  tags: MenuTag[];
  isAvailable: boolean;
  isVisible: boolean;
  isFeatured: boolean;
  /** Translations by language (empty texts already removed). */
  i18n: Record<string, Record<string, string>>;
};

/**
 * Menu of the owner's café (every SQL function checks ownership). Errors: DataError "forbidden"
 * | "invalid_input" (field via inputField()) | "conflict" (category name) | "in_use" (category
 * has items) | "stale_list" | "invalid_state" (template on a non-empty menu).
 */
export class MenuService {
  constructor(private readonly db: LazyDb) {}

  async get(slug: string): Promise<Menu> {
    const raw = unwrap("get_my_menu", await (await this.db()).rpc("get_my_menu", { p_slug: slug }));
    return menuSchema.parse(raw);
  }

  async saveCategory(
    slug: string,
    id: string | null,
    name: string,
    isVisible: boolean,
    i18n?: Record<string, Record<string, string>>,
  ) {
    return unwrap(
      "save_my_menu_category",
      await (
        await this.db()
      ).rpc("save_my_menu_category", {
        p_slug: slug,
        p_id: id,
        p_name: name,
        p_is_visible: isVisible,
        ...(i18n ? { p_i18n: i18n as unknown as Json } : {}),
      }),
    );
  }

  async deleteCategory(slug: string, id: string): Promise<void> {
    unwrap(
      "delete_my_menu_category",
      await (await this.db()).rpc("delete_my_menu_category", { p_slug: slug, p_id: id }),
    );
  }

  async reorderCategories(slug: string, ids: string[]): Promise<void> {
    unwrap(
      "reorder_my_menu_categories",
      await (await this.db()).rpc("reorder_my_menu_categories", { p_slug: slug, p_ids: ids }),
    );
  }

  async saveItem(slug: string, id: string | null, i: MenuItemInput): Promise<string> {
    return unwrap(
      "save_my_menu_item",
      await (
        await this.db()
      ).rpc("save_my_menu_item", {
        p_slug: slug,
        p_id: id,
        p_category_id: i.categoryId,
        p_name: i.name,
        p_description: i.description,
        p_price: i.price,
        p_image: i.image as unknown as Json,
        p_tags: i.tags,
        p_is_available: i.isAvailable,
        p_is_visible: i.isVisible,
        p_is_featured: i.isFeatured,
        p_i18n: i.i18n as unknown as Json,
      }),
    );
  }

  async setAvailable(slug: string, id: string, available: boolean): Promise<void> {
    unwrap(
      "set_my_menu_item_available",
      await (
        await this.db()
      ).rpc("set_my_menu_item_available", {
        p_slug: slug,
        p_id: id,
        p_available: available,
      }),
    );
  }

  async deleteItem(slug: string, id: string): Promise<void> {
    unwrap(
      "delete_my_menu_item",
      await (await this.db()).rpc("delete_my_menu_item", { p_slug: slug, p_id: id }),
    );
  }

  async reorderItems(slug: string, categoryId: string, ids: string[]): Promise<void> {
    unwrap(
      "reorder_my_menu_items",
      await (
        await this.db()
      ).rpc("reorder_my_menu_items", {
        p_slug: slug,
        p_category_id: categoryId,
        p_ids: ids,
      }),
    );
  }

  async applyTemplate(slug: string): Promise<void> {
    unwrap(
      "apply_my_menu_template",
      await (await this.db()).rpc("apply_my_menu_template", { p_slug: slug }),
    );
  }
}
