import { describe, expect, it } from "vitest";
import {
  defaultWebsite,
  translatableFields,
  translateWebsite,
  groupHours,
  parseWebsite,
  websiteErrors,
  websiteSchema,
  type Website,
} from "./schema";

const CAFE = "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed";
const base = () => defaultWebsite({ name: "Lune Bleue" });
const errorsOf = (w: unknown) => {
  const r = websiteSchema.safeParse(w);
  return r.success ? {} : websiteErrors(r.error);
};

describe("websiteSchema", () => {
  it("accepts the default website", () => {
    expect(websiteSchema.safeParse(base()).success).toBe(true);
  });

  it("requires content in sections that are shown", () => {
    const w = base();
    w.sections = w.sections.map((s) => ({ ...s, enabled: true }));
    expect(errorsOf(w)).toMatchObject({
      "sections.1.text": expect.stringContaining("story"),
      "sections.2.images": expect.stringContaining("photo"),
    });
  });

  it("ignores empty hidden sections", () => {
    const w = base();
    expect(w.sections.find((s) => s.type === "story")?.enabled).toBe(false);
    expect(errorsOf(w)).toEqual({});
  });

  it("rejects duplicate sections and foreign image paths", () => {
    const w = base();
    w.sections[2] = { ...w.sections[0] };
    expect(errorsOf(w)["sections.2"]).toBe("Duplicate section");

    const x: Website = base();
    x.hero.image = { path: "../../etc/passwd", alt: "" };
    expect(errorsOf(x)["hero.image.path"]).toBeDefined();
    x.hero.image = { path: `${CAFE}/media/${"a".repeat(64)}.webp`, alt: "Latte" };
    expect(errorsOf(x)).toEqual({});
    x.hero.image = { path: `${CAFE}/website/abc_1.webp`, alt: "Older upload" };
    expect(errorsOf(x)).toEqual({});
  });

  it("limits highlights and validates hours", () => {
    const w = base();
    w.hero.highlights = Array.from({ length: 5 }, () => ({ icon: "star", label: "x" }));
    w.footer.hours[2] = { closed: false, open: "09:00", close: "09:00" };
    const e = errorsOf(w);
    expect(e["hero.highlights"]).toBeDefined();
    expect(e["footer.hours.2.close"]).toBeDefined();
  });

  it("parseWebsite returns null for unreadable data", () => {
    expect(parseWebsite({ version: 99 })).toBeNull();
    expect(parseWebsite(base())).toEqual(base());
  });
});

describe("groupHours", () => {
  it("groups consecutive days with the same hours", () => {
    const hours = base().footer.hours;
    hours[6] = { closed: true, open: "09:00", close: "20:00" };
    expect(groupHours(hours)).toEqual([
      { days: "Monday – Friday", hours: "08:00 – 20:00" },
      { days: "Saturday", hours: "09:00 – 20:00" },
      { days: "Sunday", hours: "Closed" },
    ]);
  });
});

describe("website translations", () => {
  it("lists visitor-facing texts with stable keys", () => {
    const keys = translatableFields(base()).map((f) => f.key);
    expect(keys).toContain("hero.title");
    expect(keys).toContain("sections.how_it_works.text");
    // hidden story is still translatable once it has text; empty texts are skipped
    expect(keys).not.toContain("hero.badge");
  });

  it("translates with fallback to the main text", () => {
    const w = base();
    w.i18n = { en: { "hero.title": "Welcome!", "sections.how_it_works.title": "  " } };
    const en = translateWebsite(w, "en");
    expect(en.hero.title).toBe("Welcome!");
    expect(en.hero.subtitle).toBe(w.hero.subtitle);
    expect(en.sections[0].title).toBe(w.sections[0].title);
    expect(translateWebsite(w, "ar")).toBe(w);
  });

  it("accepts translations in the document", () => {
    const w = base();
    w.i18n = { en: { "hero.title": "Hi" } };
    expect(websiteSchema.safeParse(w).success).toBe(true);
    expect(websiteSchema.safeParse({ ...w, i18n: { english: {} } }).success).toBe(false);
  });
});
