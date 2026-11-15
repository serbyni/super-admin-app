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

/** Where an owner in this status should land after signing in. */
export function pathForStatus(status: OwnerStatus | null): string {
  switch (status) {
    case "profile_incomplete":
      return "/register/complete";
    case "email_unverified":
      return "/register/check-email";
    case null:
      return "/login";
    default:
      // pending_approval, rejected, approved, onboarding, active, suspended:
      // /pending explains the state until onboarding and dashboards exist.
      return "/pending";
  }
}
