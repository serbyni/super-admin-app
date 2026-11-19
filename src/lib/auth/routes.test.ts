import { describe, expect, it } from "vitest";
import { isAdminPath, isGuestOnlyPath, loginWithNext, safeNext, tenantSlugOf } from "./routes";

describe("route map", () => {
  it("detects guest-only pages (exact paths only)", () => {
    expect(isGuestOnlyPath("/login")).toBe(true);
    expect(isGuestOnlyPath("/register")).toBe(true);
    expect(isGuestOnlyPath("/register/")).toBe(true);
    expect(isGuestOnlyPath("/forgot-password")).toBe(true);
    // status pages for signed-in owners are NOT guest-only
    expect(isGuestOnlyPath("/register/complete")).toBe(false);
    expect(isGuestOnlyPath("/register/check-email")).toBe(false);
    expect(isGuestOnlyPath("/pending")).toBe(false);
  });

  it("detects admin and tenant pages", () => {
    expect(isAdminPath("/admin")).toBe(true);
    expect(isAdminPath("/admin/users/1")).toBe(true);
    expect(isAdminPath("/administrator")).toBe(false);
    expect(tenantSlugOf("/artisan-brew/dashboard")).toBe("artisan-brew");
    expect(tenantSlugOf("/artisan-brew/dashboard/menu")).toBe("artisan-brew");
    expect(tenantSlugOf("/about")).toBe(null);
    expect(tenantSlugOf("/admin/cafes/x")).toBe(null);
  });

  it("only accepts same-site relative next paths", () => {
    expect(safeNext("/admin/users")).toBe("/admin/users");
    expect(safeNext("//evil.example")).toBe(null);
    expect(safeNext("/\\\\evil.example")).toBe(null);
    expect(safeNext("https://evil.example")).toBe(null);
    expect(safeNext(null)).toBe(null);
    expect(loginWithNext("/admin/users?tab=all")).toBe("/login?next=%2Fadmin%2Fusers%3Ftab%3Dall");
  });
});
