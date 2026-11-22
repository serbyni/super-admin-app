import { z } from "zod";

/*
 * Menu tags of a café (menu_tags): the 6 built-ins (key set; named by the `tags` translations
 * until the owner renames them) and the owner's own tags (name + translations + an icon).
 * cafe-app resolves the same way (lib/menu/public.ts) — keep them in sync.
 */

/** Icons a tag may use (same list as platform.tag_icons() in SQL). */
export const TAG_ICONS = [
  "local_fire_department",
  "new_releases",
  "eco",
  "spa",
  "grain",
  "whatshot",
  "star",
  "favorite",
  "recommend",
  "workspace_premium",
  "home",
  "cooking",
  "local_cafe",
  "emoji_food_beverage",
  "icecream",
  "ac_unit",
  "cake",
  "bakery_dining",
  "egg",
  "nutrition",
  "water_drop",
  "no_food",
  "sell",
  "sports_bar",
] as const;
export type TagIcon = (typeof TAG_ICONS)[number];

export const BUILTIN_TAGS = [
  "popular",
  "new",
  "vegetarian",
  "vegan",
  "gluten_free",
  "spicy",
] as const;
export type BuiltinTag = (typeof BUILTIN_TAGS)[number];
export const MAX_TAGS = 40;

const num = z.coerce.number();

/** A tag as get_my_menu returns it. */
export const menuTagSchema = z.object({
  id: z.string(),
  key: z.enum(BUILTIN_TAGS).nullable().catch(null),
  name: z.string().nullable(),
  icon: z.string(),
  i18n: z.record(z.string(), z.record(z.string(), z.string())).catch({}),
  sortOrder: num,
  isVisible: z.boolean(),
  itemCount: num.default(0),
});
export type MenuTagRow = z.infer<typeof menuTagSchema>;

/** Tag form (checked again in the database). Empty name on a built-in = back to the default. */
export const tagFormSchema = z.object({
  name: z.string().trim().max(40, "At most 40 characters"),
  icon: z.enum(TAG_ICONS),
  isVisible: z.boolean(),
  i18n: z
    .record(
      z.string().regex(/^[a-z]{2}$/),
      z.object({ name: z.string().trim().max(40).optional() }),
    )
    .default({}),
});

/**
 * Name of a tag in a language: its translation, else its own name, else (built-in) the default
 * translation given by `builtin(key)`.
 */
export function tagName(
  tag: Pick<MenuTagRow, "key" | "name" | "i18n">,
  locale: string,
  builtin: (key: BuiltinTag) => string,
): string {
  if (tag.name) return tag.i18n[locale]?.name?.trim() || tag.name;
  return tag.key ? builtin(tag.key) : "";
}

/** True while a built-in keeps its default (translated) name. */
export const isDefaultName = (tag: Pick<MenuTagRow, "key" | "name">) => !!tag.key && !tag.name;
