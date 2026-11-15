import { describe, expect, it } from "vitest";
import { passwordStrength } from "./password-strength";
import { fieldErrors, registerSchema } from "./register-schema";

const valid = {
  fullName: "Amira Ben Salah",
  phone: "+216 20 000 000",
  email: "  Owner@YourCafe.com ",
  businessName: "Artisan Brew",
  businessType: "cafe",
  password: "Espresso#2026",
  confirmPassword: "Espresso#2026",
  terms: "on",
};

describe("registerSchema", () => {
  it("accepts a valid sign-up and normalises email and phone", () => {
    const r = registerSchema.safeParse(valid);
    expect(r.success).toBe(true);
    expect(r.data?.email).toBe("owner@yourcafe.com");
    expect(r.data?.phone).toBe("+21620000000");
  });

  it("rejects mismatched passwords on confirmPassword", () => {
    const r = registerSchema.safeParse({ ...valid, confirmPassword: "Other#2026xx" });
    expect(r.success).toBe(false);
    expect(fieldErrors(r.error!).confirmPassword).toBe("Passwords do not match");
  });

  it("requires a strong password", () => {
    const r = registerSchema.safeParse({ ...valid, password: "short", confirmPassword: "short" });
    expect(fieldErrors(r.error!).password).toMatch(/at least 10/);
  });

  it("requires phone with country code", () => {
    const r = registerSchema.safeParse({ ...valid, phone: "20 000 000" });
    expect(fieldErrors(r.error!).phone).toMatch(/country code/);
  });

  it("requires accepting the terms", () => {
    const r = registerSchema.safeParse({ ...valid, terms: undefined });
    expect(fieldErrors(r.error!).terms).toMatch(/accept/);
  });

  it("rejects malformed business types", () => {
    const r = registerSchema.safeParse({ ...valid, businessType: "Not A Slug" });
    expect(fieldErrors(r.error!).businessType).toBeDefined();
  });
});

describe("passwordStrength", () => {
  it.each([
    ["", 0, "empty"],
    ["abc", 0, "weak"],
    ["abcdefghij", 1, "weak"],
    ["Abcdefghij", 2, "fair"],
    ["Abcdefghi1", 3, "good"],
    ["Abcdefgh1!", 4, "strong"],
  ])("%s → %i %s", (pw, score, label) => {
    expect(passwordStrength(pw)).toEqual({ score, label });
  });
});
