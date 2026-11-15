import { describe, expect, it } from "vitest";
import { businessTypeFormSchema, localizedName } from "./schema";

const base = {
  id: "",
  slug: " Food_Truck ",
  name_en: "Food truck",
  name_fr: "",
  name_ar: "شاحنة طعام",
  icon: "local_shipping",
  sort_order: "50",
  is_active: "on",
};

describe("businessTypeFormSchema", () => {
  it("parses a new type", () => {
    const r = businessTypeFormSchema.parse(base);
    expect(r).toMatchObject({
      id: null,
      slug: "food_truck",
      name_fr: undefined,
      name_ar: "شاحنة طعام",
      sort_order: 50,
      is_active: true,
    });
  });

  it("treats a missing checkbox as inactive", () => {
    expect(businessTypeFormSchema.parse({ ...base, is_active: undefined }).is_active).toBe(false);
  });

  it.each(["1cafe", "café", "has space", "a"])("rejects slug %s", (slug) => {
    expect(businessTypeFormSchema.safeParse({ ...base, slug }).success).toBe(false);
  });

  it("requires an English name", () => {
    expect(businessTypeFormSchema.safeParse({ ...base, name_en: "x" }).success).toBe(false);
  });
});

describe("localizedName", () => {
  it("falls back to English", () => {
    expect(localizedName({ en: "Bakery", fr: "Boulangerie" }, "fr")).toBe("Boulangerie");
    expect(localizedName({ en: "Bakery" }, "ar")).toBe("Bakery");
  });
});
