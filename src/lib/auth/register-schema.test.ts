import { describe, expect, it } from "vitest";
import { passwordStrength } from "./password-strength";
import { fieldErrors, newPasswordSchema, registerSchema } from "./register-schema";

const valid = {
  fullName: "Amira Ben Salah",
  phone: "+216 20 123 456",
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
    expect(r.data?.phone).toBe("+21620123456");
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

  it("requires an international phone number", () => {
    const r = registerSchema.safeParse({ ...valid, phone: "20 123 456" });
    expect(fieldErrors(r.error!).phone).toMatch(/Choose your country/);
    expect(
      fieldErrors(registerSchema.safeParse({ ...valid, phone: "" }).error!).phone,
    ).toBeTruthy();
  });

  it("rejects numbers that are not valid for their country", () => {
    // Right length for Tunisia but no Tunisian number starts with 0.
    const r = registerSchema.safeParse({ ...valid, phone: "+216 00 000 000" });
    expect(fieldErrors(r.error!).phone).toMatch(/not valid/);
    expect(registerSchema.safeParse({ ...valid, phone: "+216 2012" }).success).toBe(false);
  });

  it("accepts and normalises other countries", () => {
    expect(registerSchema.safeParse({ ...valid, phone: "+33 6 12 34 56 78" }).data?.phone).toBe(
      "+33612345678",
    );
    expect(registerSchema.safeParse({ ...valid, phone: "+213 551 23 45 67" }).data?.phone).toBe(
      "+213551234567",
    );
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

describe("newPasswordSchema", () => {
  it("applies the register password rules and requires a matching confirmation", () => {
    expect(
      newPasswordSchema.safeParse({ password: "Espresso#2026", confirmPassword: "Espresso#2026" })
        .success,
    ).toBe(true);
    const weak = newPasswordSchema.safeParse({ password: "short", confirmPassword: "short" });
    expect(fieldErrors(weak.error!).password).toMatch(/at least 10/);
    const mismatch = newPasswordSchema.safeParse({
      password: "Espresso#2026",
      confirmPassword: "Espresso#2027",
    });
    expect(fieldErrors(mismatch.error!).confirmPassword).toBe("Passwords do not match");
  });
});
