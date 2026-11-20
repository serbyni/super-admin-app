import { enText } from "@/i18n/en-text";
import { describe, expect, it } from "vitest";
import { passwordChangeSchema, profileSchema, zodErrors } from "./schema";

describe("settings schemas", () => {
  it("profile: name + valid phone", () => {
    expect(
      profileSchema.safeParse({ full_name: " Amira ", phone: "+216 20 123 456" }).data,
    ).toEqual({
      full_name: "Amira",
      phone: "+21620123456",
    });
    expect(profileSchema.safeParse({ full_name: "A", phone: "+216 20 123 456" }).success).toBe(
      false,
    );
  });

  it("password: current required, strong new one, confirmation, different from current", () => {
    const ok = {
      current_password: "Old#Password1",
      password: "New#Password1",
      confirm_password: "New#Password1",
    };
    expect(passwordChangeSchema.safeParse(ok).success).toBe(true);
    const mismatch = passwordChangeSchema.safeParse({ ...ok, confirm_password: "x" });
    expect(enText(zodErrors(mismatch.error!).confirm_password)).toBe("Passwords do not match");
    const same = passwordChangeSchema.safeParse({ ...ok, current_password: ok.password });
    expect(enText(zodErrors(same.error!).password)).toMatch(/different/);
    const weak = passwordChangeSchema.safeParse({
      ...ok,
      password: "short",
      confirm_password: "short",
    });
    expect(zodErrors(weak.error!).password).toBeDefined();
  });
});
