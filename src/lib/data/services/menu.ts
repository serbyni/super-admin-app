import "server-only";
import type { OptionGroup } from "@/lib/menu/schema";
import type { Json } from "@/lib/supabase/database.types";
import { menuSchema, type Menu } from "@/lib/menu/schema";
import { unwrap } from "../errors";
import type { LazyDb } from "../types";

export type MenuItemInput = {
  categoryId: string;
  name: string;
  description: string;
  price: number | null;
  image: { path: string; alt: string } | null;
  /** The café's tag ids (menu_tags). */
  tagIds: string[];
  isAvailable: boolean;
  isVisible: boolean;
  isFeatured: boolean;
  /** Translations by language (empty texts already removed). */
  i18n: Record<string, Record<string, string>>;
  /** Option groups (size, milk, extras…), see OptionGroup. */
  options?: OptionGroup[];
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
        p_tags: [],
        p_tag_ids: i.tagIds,
        p_is_available: i.isAvailable,
        p_is_visible: i.isVisible,
        p_is_featured: i.isFeatured,
        p_i18n: i.i18n as unknown as Json,
        p_options: (i.options ?? []) as unknown as Json,
      }),
    );
  }

  /** Create (id null) or update a tag. An empty name on a built-in = back to its default name. */
  async saveTag(
    slug: string,
    id: string | null,
    t: {
      name: string;
      icon: string;
      isVisible: boolean;
      i18n: Record<string, Record<string, string>>;
    },
  ): Promise<string> {
    return unwrap(
      "save_my_menu_tag",
      await (
        await this.db()
      ).rpc("save_my_menu_tag", {
        p_slug: slug,
        p_id: id,
        p_name: t.name,
        p_icon: t.icon,
        p_i18n: t.i18n as unknown as Json,
        p_is_visible: t.isVisible,
      }),
    );
  }

  /** Deletes a tag (removed from its items). Returns how many items had it. */
  async deleteTag(slug: string, id: string): Promise<number> {
    return unwrap(
      "delete_my_menu_tag",
      await (await this.db()).rpc("delete_my_menu_tag", { p_slug: slug, p_id: id }),
    );
  }

  async reorderTags(slug: string, ids: string[]): Promise<void> {
    unwrap(
      "reorder_my_menu_tags",
      await (await this.db()).rpc("reorder_my_menu_tags", { p_slug: slug, p_ids: ids }),
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
