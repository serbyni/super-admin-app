import { describe, expect, it } from "vitest";
import { invalidOptionGroup, itemSchema, unitPrice, type OptionGroup } from "./schema";

const groups: OptionGroup[] = [
  {
    id: "g1",
    name: "Taille",
    i18n: {},
    min: 1,
    max: 1,
    choices: [
      { id: "c1", name: "Petit", i18n: {}, price: 0, isAvailable: true },
      { id: "c2", name: "Grand", i18n: {}, price: 1.5, isAvailable: true },
    ],
  },
  {
    id: "g2",
    name: "Extras",
    i18n: {},
    min: 0,
    max: 2,
    choices: [
      { id: "c3", name: "Crème", i18n: {}, price: 0.5, isAvailable: true },
      { id: "c4", name: "Sirop", i18n: {}, price: 0.7, isAvailable: false },
    ],
  },
];

describe("item options", () => {
  it("checks choices like the database", () => {
    expect(invalidOptionGroup(groups, ["c2", "c3"])).toBeNull();
    expect(invalidOptionGroup(groups, [])).toBe("g1"); // required
    expect(invalidOptionGroup(groups, ["c1", "c2"])).toBe("g1"); // max 1
    expect(invalidOptionGroup(groups, ["c1", "c4"])).toBe("g2"); // sold out
    expect(invalidOptionGroup(groups, ["c1", "zz"])).not.toBeNull(); // unknown
  });

  it("adds the chosen prices", () => {
    expect(unitPrice(4, groups, ["c2", "c3"])).toBe(6);
    expect(unitPrice(2.8, groups, ["c1"])).toBe(2.8);
  });

  it("validates option prices with the currency's decimals", () => {
    const base = {
      category_id: "4f7f0a0e-6b8a-4f7c-9d0a-1a2b3c4d5e6f",
      name: "Latte",
      description: "",
      price: "4.000",
      image_path: "",
      image_alt: "",
      tags: [],
      is_available: true,
      is_visible: true,
      is_featured: false,
      i18n: {},
    };
    expect(itemSchema("TND").safeParse({ ...base, options: groups }).success).toBe(true);
    const bad = structuredClone(groups);
    bad[0].choices[1].price = 1.2345;
    expect(itemSchema("TND").safeParse({ ...base, options: bad }).success).toBe(false);
    bad[0].choices[1].price = -1;
    expect(itemSchema("TND").safeParse({ ...base, options: bad }).success).toBe(false);
  });
});
