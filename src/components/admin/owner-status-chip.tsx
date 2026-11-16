import type { OwnerStatus } from "@/lib/auth/owner-status";

const STYLES: Record<OwnerStatus, { label: string; className: string }> = {
  pending_approval: { label: "Pending", className: "bg-info-container text-info" },
  approved: { label: "Approved", className: "bg-success-container text-success" },
  rejected: { label: "Declined", className: "bg-error-container text-on-error-container" },
  email_unverified: {
    label: "Email not verified",
    className: "bg-surface-container-high text-on-surface-variant",
  },
  profile_incomplete: {
    label: "Profile incomplete",
    className: "bg-surface-container-high text-on-surface-variant",
  },
  onboarding: {
    label: "Onboarding",
    className: "bg-secondary-container text-on-secondary-container",
  },
  active: { label: "Active", className: "bg-success-container text-success" },
  suspended: { label: "Suspended", className: "bg-error-container text-on-error-container" },
};

export function ownerStatusLabel(status: OwnerStatus): string {
  return STYLES[status].label;
}

export function OwnerStatusChip({ status }: { status: OwnerStatus }) {
  const s = STYLES[status];
  return (
    <span
      className={`inline-flex rounded-full px-sm py-xs font-label-sm text-label-sm whitespace-nowrap ${s.className}`}
    >
      {s.label}
    </span>
  );
}
