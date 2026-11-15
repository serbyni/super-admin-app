/**
 * Icons a super admin can pick for a business type (Material Symbols Outlined names).
 * Curated for cafés / restaurants; the server only accepts names from this list.
 */
export const BUSINESS_ICON_GROUPS = [
  {
    label: "Coffee & drinks",
    icons: [
      "local_cafe",
      "coffee",
      "coffee_maker",
      "emoji_food_beverage",
      "local_drink",
      "local_bar",
      "wine_bar",
      "sports_bar",
      "liquor",
      "blender",
    ],
  },
  {
    label: "Food",
    icons: [
      "restaurant",
      "restaurant_menu",
      "dinner_dining",
      "lunch_dining",
      "brunch_dining",
      "breakfast_dining",
      "fastfood",
      "local_pizza",
      "ramen_dining",
      "rice_bowl",
      "set_meal",
      "kebab_dining",
      "tapas",
      "soup_kitchen",
      "outdoor_grill",
      "egg",
    ],
  },
  {
    label: "Bakery & sweets",
    icons: ["bakery_dining", "cake", "cookie", "icecream", "nutrition"],
  },
  {
    label: "Shop & service",
    icons: [
      "storefront",
      "store",
      "local_grocery_store",
      "shopping_bag",
      "takeout_dining",
      "delivery_dining",
      "local_shipping",
      "room_service",
      "kitchen",
      "deck",
      "nightlife",
      "celebration",
      "local_florist",
      "eco",
    ],
  },
] as const;

export type BusinessIcon = (typeof BUSINESS_ICON_GROUPS)[number]["icons"][number];

export const BUSINESS_ICONS: readonly BusinessIcon[] = BUSINESS_ICON_GROUPS.flatMap(
  (g) => g.icons,
) as BusinessIcon[];

export const DEFAULT_BUSINESS_ICON: BusinessIcon = "storefront";

/** "local_grocery_store" → "Local grocery store" (for labels and search). */
export function iconLabel(name: string): string {
  const s = name.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}
