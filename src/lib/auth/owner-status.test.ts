import { describe, expect, it } from "vitest";
import { isOwnerStatus, pathForStatus } from "./owner-status";

describe("pathForStatus", () => {
  it.each([
    ["profile_incomplete", "/register/complete"],
    ["email_unverified", "/register/check-email"],
    ["pending_approval", "/pending"],
    ["rejected", "/pending"],
    [null, "/login"],
  ] as const)("%s → %s", (status, path) => {
    expect(pathForStatus(status)).toBe(path);
  });

  it("validates status strings", () => {
    expect(isOwnerStatus("approved")).toBe(true);
    expect(isOwnerStatus("bogus")).toBe(false);
  });
});
