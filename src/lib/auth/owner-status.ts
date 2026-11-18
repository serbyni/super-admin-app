export const OWNER_STATUSES = [
  "profile_incomplete",
  "email_unverified",
  "pending_approval",
  "approved",
  "rejected",
  "onboarding",
  "active",
  "suspended",
] as const;

export type OwnerStatus = (typeof OWNER_STATUSES)[number];

export function isOwnerStatus(value: unknown): value is OwnerStatus {
  return typeof value === "string" && (OWNER_STATUSES as readonly string[]).includes(value);
}

/**
 * Where a signed-in owner in this status belongs (active owners: see AuthService.homePath, which
 * also needs the café slug). `null` = signed in but no owner account yet → complete the profile.
 */
export function pathForStatus(status: OwnerStatus | null): string {
  switch (status) {
    case null:
    case "profile_incomplete":
      return "/register/complete";
    case "email_unverified":
      return "/register/check-email";
    case "approved":
    case "onboarding":
    case "active": // active without a café slug yet → finish onboarding
      return "/onboarding";
    default:
      // pending_approval, rejected, suspended: the status page explains the state.
      return "/pending";
  }
}
