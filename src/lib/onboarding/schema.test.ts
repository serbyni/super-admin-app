import { describe, expect, it } from "vitest";
import { agreementSchema, createCafeSchema, detailsSchema, lookSchema } from "./schema";

const details = {
  name: "Café Lune",
  country_code: "tn",
  city: "Tunis",
  address: "1 Rue X",
  currency: "tnd",
  timezone: "Africa/Tunis",
  locale: "fr",
};

describe("onboarding schemas", () => {
  it("normalises details (upper-case codes) and rejects unknown time zones", () => {
    const r = detailsSchema.safeParse(details);
    expect(r.data).toMatchObject({ country_code: "TN", currency: "TND" });
    expect(detailsSchema.safeParse({ ...details, timezone: "Mars/Olympus" }).success).toBe(false);
    expect(detailsSchema.safeParse({ ...details, locale: "de" }).success).toBe(false);
  });

  it("accepts only #rrggbb colours (lower-cased)", () => {
    expect(lookSchema.safeParse({ seed: "#6F4E37" }).data?.seed).toBe("#6f4e37");
    expect(lookSchema.safeParse({ seed: "brown" }).success).toBe(false);
  });

  it("requires both agreements", () => {
    expect(agreementSchema.safeParse({ terms: true, dpa: true }).success).toBe(true);
    expect(agreementSchema.safeParse({ terms: true, dpa: false }).success).toBe(false);
  });

  it("validates the whole draft before creating, normalising the address", () => {
    const r = createCafeSchema.safeParse({
      ...details,
      slug: " Café Lune ",
      seed: "#6f4e37",
      terms: true,
      dpa: true,
    });
    expect(r.success).toBe(true);
    expect(r.data?.slug).toBe("cafe-lune");
    expect(
      createCafeSchema.safeParse({
        ...details,
        slug: "admin",
        seed: "#6f4e37",
        terms: true,
        dpa: true,
      }).success,
    ).toBe(false);
  });
});
