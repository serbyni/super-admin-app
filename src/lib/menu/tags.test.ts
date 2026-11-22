import { describe, expect, it } from "vitest";
import {
  CATEGORY_ICONS,
  TAG_ICONS,
  isDefaultName,
  menuTagSchema,
  tagFormSchema,
  tagName,
} from "./tags";

const builtin = (k: string) => ({ popular: "Populaire", spicy: "Épicé" })[k] ?? k;

describe("menu tags", () => {
  it("built-in names come from the app until renamed; custom names use their translation", () => {
    const pop = { key: "popular" as const, name: null, i18n: {} };
    expect(tagName(pop, "fr", builtin)).toBe("Populaire");
    expect(isDefaultName(pop)).toBe(true);
    const renamed = {
      key: "popular" as const,
      name: "Coup de cœur",
      i18n: { en: { name: "Favourite" } },
    };
    expect(tagName(renamed, "fr", builtin)).toBe("Coup de cœur");
    expect(tagName(renamed, "en", builtin)).toBe("Favourite");
    expect(isDefaultName(renamed)).toBe(false);
    const custom = {
      key: null,
      name: "Fait maison",
      i18n: { ar: { name: "منزلي" }, en: { name: " " } },
    };
    expect(tagName(custom, "ar", builtin)).toBe("منزلي");
    expect(tagName(custom, "en", builtin)).toBe("Fait maison");
  });

  it("24 distinct icons; the form only accepts them", () => {
    expect(new Set(TAG_ICONS).size).toBe(24);
    expect(new Set(CATEGORY_ICONS).size).toBe(24);
    expect(tagFormSchema.safeParse({ name: "X", icon: "star", isVisible: true }).success).toBe(
      true,
    );
    expect(tagFormSchema.safeParse({ name: "X", icon: "pizza", isVisible: true }).success).toBe(
      false,
    );
    expect(
      tagFormSchema.safeParse({ name: "x".repeat(41), icon: "star", isVisible: true }).success,
    ).toBe(false);
  });

  it("reads get_my_menu tags (unknown key → custom)", () => {
    const t = menuTagSchema.parse({
      id: "a",
      key: "weird",
      name: "A",
      icon: "star",
      i18n: null,
      sortOrder: "2",
      isVisible: true,
    });
    expect(t).toMatchObject({ key: null, i18n: {}, sortOrder: 2, itemCount: 0 });
  });
});
