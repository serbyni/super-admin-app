import type { CafeStatus } from "@/lib/data/services/cafes";

const STYLES: Record<CafeStatus, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-success-container text-success" },
  suspended: { label: "Suspended", className: "bg-error-container text-on-error-container" },
};

export function CafeStatusChip({ status }: { status: CafeStatus }) {
  const s = STYLES[status];
  return (
    <span
      className={`inline-flex rounded-full px-sm py-xs font-label-sm text-label-sm whitespace-nowrap ${s.className}`}
    >
      {s.label}
    </span>
  );
}
