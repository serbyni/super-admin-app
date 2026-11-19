import { describe, expect, it } from "vitest";
import { cafeContactSchema, normalizeFacebook, normalizeInstagram, socialHandle } from "./contact";

describe("social links", () => {
  it.each([
    ["lunebleue", "https://www.facebook.com/lunebleue"],
    ["@lunebleue", "https://www.facebook.com/lunebleue"],
    ["facebook.com/lunebleue", "https://www.facebook.com/lunebleue"],
    ["https://m.facebook.com/lunebleue/", "https://www.facebook.com/lunebleue"],
    ["https://fb.com/Lune.Bleue", "https://www.facebook.com/Lune.Bleue"],
    ["  ", ""],
  ])("facebook %s → %s", (input, out) => expect(normalizeFacebook(input)).toBe(out));

  it.each(["https://evil.com/lunebleue", "facebook.com/", "lune bleue", "facebook.com/../x"])(
    "rejects facebook %s",
    (input) => expect(normalizeFacebook(input)).toBeNull(),
  );

  it.each([
    ["@lune.bleue", "https://www.instagram.com/lune.bleue"],
    ["lune_bleue", "https://www.instagram.com/lune_bleue"],
    ["instagram.com/lunebleue/", "https://www.instagram.com/lunebleue"],
    ["https://www.instagram.com/lunebleue?igsh=abc", "https://www.instagram.com/lunebleue"],
  ])("instagram %s → %s", (input, out) => expect(normalizeInstagram(input)).toBe(out));

  it.each(["https://instagram.com/a/b", "https://twitter.com/lune", "lune-bleue", "@"])(
    "rejects instagram %s",
    (input) => expect(normalizeInstagram(input)).toBeNull(),
  );

  it("shows a short handle", () => {
    expect(socialHandle("https://www.instagram.com/lune")).toBe("@lune");
    expect(socialHandle("https://www.facebook.com/lune.bleue")).toBe("lune.bleue");
    expect(socialHandle(null)).toBe("");
  });

  it("stored links match the database rules", () => {
    const fb = /^https:\/\/www\.facebook\.com\/[A-Za-z0-9._/-]{1,100}$/;
    const ig = /^https:\/\/www\.instagram\.com\/[A-Za-z0-9._]{1,30}$/;
    expect(normalizeFacebook("fb.com/pages/lune/123")).toMatch(fb);
    expect(normalizeInstagram("@lune.bleue_42")).toMatch(ig);
  });
});

describe("cafeContactSchema", () => {
  it("requires phone + email, normalises everything, social pages optional", () => {
    const r = cafeContactSchema.safeParse({
      phone: "+216 71 123 456",
      email: " Hello@LuneBleue.TN ",
      facebook: "",
      instagram: "@lunebleue",
    });
    expect(r.data).toEqual({
      phone: "+21671123456",
      email: "hello@lunebleue.tn",
      facebook: undefined,
      instagram: "https://www.instagram.com/lunebleue",
    });
  });

  it("reports each bad field", () => {
    const r = cafeContactSchema.safeParse({ phone: "123", email: "nope", instagram: "a/b" });
    const fields = new Set(r.error?.issues.map((i) => i.path[0]));
    expect(fields).toEqual(new Set(["phone", "email", "instagram"]));
  });
});
