import { z } from "zod";
import { MEDIA_PATH } from "@/lib/media/config";
import { MAX_TAGS, menuTagSchema } from "./tags";

/*
 * Menu: form rules, prices and the data returned by get_my_menu (tags: lib/menu/tags.ts).
 * cafe-app keeps a copy of the price/tag helpers (lib/menu/schema.ts) — keep them in sync.
 */

export const MENU_LIMITS = { categories: 50, items: 500 } as const;

/** Decimals used by a currency (ISO 4217 minor units; default 2). */
const MINOR_UNITS: Record<string, number> = {
  TND: 3,
  KWD: 3,
  BHD: 3,
  OMR: 3,
  JOD: 3,
  IQD: 3,
  LYD: 3,
  JPY: 0,
  KRW: 0,
  VND: 0,
  CLP: 0,
  ISK: 0,
  XOF: 0,
  XAF: 0,
  UGX: 0,
  RWF: 0,
};
export const currencyDigits = (currency: string) => MINOR_UNITS[currency.toUpperCase()] ?? 2;

/**
 * Price as shown everywhere, e.g. "4.500 TND", "3.20 EUR". Deterministic on purpose (no Intl
 * currency formatting: Node and browsers format differently → hydration mismatches).
 */
export function formatPrice(price: number, currency: string): string {
  return `${price.toFixed(currencyDigits(currency))} ${currency.toUpperCase()}`;
}

/** "4,5" / "4.500" / " 4.5 " → 4.5; "" → null (not priced); invalid → NaN. */
export function parsePrice(raw: string): number | null {
  const s = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (s === "") return null;
  return /^\d{1,6}(\.\d{1,3})?$/.test(s) ? Number(s) : Number.NaN;
}

/** Item form (price as typed; checked against the café currency's decimals). */
export function itemSchema(currency: string) {
  const digits = currencyDigits(currency);
  return z.object({
    category_id: z.uuid("Choose a category"),
    name: z.string().trim().min(1, "Enter a name").max(80, "At most 80 characters"),
    description: z.string().trim().max(500, "At most 500 characters"),
    price: z.string().transform((v, ctx) => {
      const p = parsePrice(v);
      if (p === null) return null;
      const decimals = (v.trim().replace(",", ".").split(".")[1] ?? "").length;
      if (Number.isNaN(p) || decimals > digits) {
        ctx.addIssue({
          code: "custom",
          message: digits ? `Enter a price like ${(4.5).toFixed(digits)}` : "Enter a whole number",
        });
        return z.NEVER;
      }
      return p;
    }),
    image_path: z.union([z.literal(""), z.string().regex(MEDIA_PATH, "Upload the photo again")]),
    image_alt: z.string().trim().max(150),
    tag_ids: z.array(z.uuid()).max(MAX_TAGS),
    is_available: z.boolean(),
    is_visible: z.boolean(),
    is_featured: z.boolean(),
    i18n: itemI18nSchema,
    options: z
      .array(
        optionGroupSchema.extend({
          choices: z
            .array(
              optionChoiceSchema.refine(
                (c) => Math.round(c.price * 10 ** digits) === c.price * 10 ** digits,
                { message: "Check the option prices" },
              ),
            )
            .min(1)
            .max(OPTION_LIMITS.choices),
        }),
      )
      .max(OPTION_LIMITS.groups)
      .refine((gs) => gs.every((g) => g.max <= g.choices.length), {
        message: "Check the option groups",
      })
      .default([]),
  });
}
export type ItemForm = z.infer<ReturnType<typeof itemSchema>>;

/* ── Item options (size, milk, extras…) ── */

export const OPTION_LIMITS = { groups: 6, choices: 12 } as const;

const nameI18n = z
  .record(z.string().regex(/^[a-z]{2}$/), z.object({ name: z.string().trim().max(40).optional() }))
  .default({});

/** A choice of an option group; `price` is added to the item price. */
export const optionChoiceSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().trim().min(1, "Enter a name").max(40),
  i18n: nameI18n,
  price: z.number().min(0).max(99999),
  isAvailable: z.boolean(),
});
/** Option group: min 1 = required; max = how many choices a customer may pick. */
export const optionGroupSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().trim().min(1, "Enter a name").max(40),
  i18n: nameI18n,
  min: z.number().int().min(0).max(1),
  max: z.number().int().min(1).max(OPTION_LIMITS.choices),
  choices: z.array(optionChoiceSchema).min(1).max(OPTION_LIMITS.choices),
});
export type OptionGroup = z.infer<typeof optionGroupSchema>;
export type OptionChoice = OptionGroup["choices"][number];

/** Options as stored (bad shape → none). */
export const optionsSchema = z.array(optionGroupSchema).catch([]);

/**
 * Checks a customer's choices against the item's groups (same rules as place_order): known,
 * available, each group between min and max. Returns the first invalid group id, or null.
 */
export function invalidOptionGroup(groups: OptionGroup[], choiceIds: string[]): string | null {
  const known = new Set(groups.flatMap((g) => g.choices.map((c) => c.id)));
  if (choiceIds.some((id) => !known.has(id))) return groups[0]?.id ?? "options";
  for (const g of groups) {
    const picked = g.choices.filter((c) => choiceIds.includes(c.id));
    if (picked.some((c) => !c.isAvailable) || picked.length < g.min || picked.length > g.max)
      return g.id;
  }
  return null;
}

/** Item price + chosen options (rounded to 3 decimals like the database). */
export function unitPrice(base: number, groups: OptionGroup[], choiceIds: string[]): number {
  const extra = groups
    .flatMap((g) => g.choices)
    .filter((c) => choiceIds.includes(c.id))
    .reduce((n, c) => n + c.price, 0);
  return Math.round((base + extra) * 1000) / 1000;
}

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(60, "At most 60 characters"),
});

const num = z.coerce.number();
/** Translations of a record: { "en": { "name": "…", "description": "…" } }. */
const i18nSchema = z.record(z.string(), z.record(z.string(), z.string())).catch({});

/** Translations sent by the item form (checked again in the database). */
export const itemI18nSchema = z
  .record(
    z.string().regex(/^[a-z]{2}$/),
    z.object({
      name: z.string().trim().max(80).optional(),
      description: z.string().trim().max(500).optional(),
    }),
  )
  .default({});
export const categoryI18nSchema = z
  .record(z.string().regex(/^[a-z]{2}$/), z.object({ name: z.string().trim().max(60).optional() }))
  .default({});

export const menuSchema = z.object({
  categories: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      sortOrder: num,
      isVisible: z.boolean(),
      i18n: i18nSchema,
      /** Optional icon (CATEGORY_ICONS). */
      icon: z.string().nullable().catch(null),
      itemCount: num.default(0),
    }),
  ),
  tags: z.array(menuTagSchema).default([]),
  items: z.array(
    z.object({
      id: z.string(),
      categoryId: z.string(),
      name: z.string(),
      description: z.string(),
      price: num.nullable(),
      image: z.object({ path: z.string(), alt: z.string().catch("") }).nullable(),
      tagIds: z.array(z.string()).catch([]),
      isAvailable: z.boolean(),
      isVisible: z.boolean(),
      isFeatured: z.boolean(),
      sortOrder: num,
      i18n: i18nSchema,
      options: optionsSchema.default([]),
    }),
  ),
});
export type Menu = z.infer<typeof menuSchema>;
export type MenuCategory = Menu["categories"][number];
export type MenuItem = Menu["items"][number];

/** What customers see for an item: hidden (owner choice), not priced, sold out or on sale. */
export function itemStatus(i: Pick<MenuItem, "isVisible" | "price" | "isAvailable">) {
  if (!i.isVisible) return "hidden" as const;
  if (i.price === null) return "no_price" as const;
  return i.isAvailable ? ("available" as const) : ("sold_out" as const);
}
