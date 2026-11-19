import { describe, expect, it } from "vitest";
import { tenantSlugOf } from "@/lib/auth/routes";
import {
  RESERVED_SLUGS,
  SLUG_MESSAGES,
  isValidSlugFormat,
  localSlugProblem,
  normalizeSlug,
  slugSchema,
} from "./slug";

/** Captured from the database (platform.normalize_slug + the cafes.slug check) on 2026-11-18. */
const DB_PARITY: [input: string, normalized: string, valid: boolean][] = [
  ["  Café Lune ", "cafe-lune", true],
  ["L'Ariana Coffee", "l-ariana-coffee", true],
  ["Crème Brûlée & Co.", "creme-brulee-co", true],
  ["Straße Café", "strasse-cafe", true],
  ["Œuvre Bar", "oeuvre-bar", true],
  ["Æble", "aeble", true],
  ["مقهى النخيل", "", false],
  ["2 Pigeons", "2-pigeons", true],
  ["a--b", "a-b", true],
  ["---x---", "x", false],
  ["Tunis   Centre", "tunis-centre", true],
  ["ÇA VA", "ca-va", true],
  ["ab", "ab", false],
  ["abcdefghijklmnopqrstuvwxyz12345", "abcdefghijklmnopqrstuvwxyz12345", false],
];

/** = select slug from platform.reserved_slugs (2026-11-18). */
const DB_RESERVED =
  "about,account,admin,admin-staging,api,app,assets,auth,billing,blog,cdn,contact,dashboard,dev,docs,dpa,forgot-password,help,login,logout,mail,menu,onboarding,pending,privacy,q,register,reset-password,rsend,send,serbi,settings,staging,static,status,support,terms,test,www";

describe("café address rules (parity with the database)", () => {
  it.each(DB_PARITY)("normalize %j → %j (valid: %s)", (input, normalized, valid) => {
    expect(normalizeSlug(input)).toBe(normalized);
    expect(isValidSlugFormat(normalized)).toBe(valid);
  });

  it("has the same reserved list as platform.reserved_slugs", () => {
    expect([...RESERVED_SLUGS].sort().join(",")).toBe(DB_RESERVED);
  });
});

describe("local problems", () => {
  it("detects format and reserved names (incl. *-dev)", () => {
    expect(localSlugProblem("x")).toBe("format");
    expect(localSlugProblem("-cafe")).toBe("format");
    expect(localSlugProblem("a--b")).toBe("format");
    expect(localSlugProblem("admin")).toBe("reserved");
    expect(localSlugProblem("onboarding")).toBe("reserved");
    expect(localSlugProblem("lune-dev")).toBe("reserved");
    expect(localSlugProblem("cafe-lune")).toBe(null);
    expect(localSlugProblem("2-pigeons")).toBe(null);
  });

  it("slugSchema normalizes and explains the problem", () => {
    expect(slugSchema.safeParse(" Café Lune ").data).toBe("cafe-lune");
    expect(slugSchema.safeParse("admin").error?.issues[0]?.message).toBe(SLUG_MESSAGES.reserved);
    expect(slugSchema.safeParse("x").error?.issues[0]?.message).toBe(SLUG_MESSAGES.format);
  });
});

describe("tenant URL pattern uses the same format", () => {
  it.each(["cafe-lune", "2-pigeons", "abc", "a".repeat(30)])("%s is a tenant path", (slug) => {
    expect(tenantSlugOf(`/${slug}/dashboard`)).toBe(slug);
  });
  it.each(["ab", "a".repeat(31), "-cafe", "cafe-"])("%s is not", (slug) => {
    expect(tenantSlugOf(`/${slug}/dashboard`)).toBe(null);
  });
});
