import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";

/** One label/value row of an admin detail card. */
export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-xs py-sm sm:grid-cols-3">
      <dt className="text-body-sm text-on-surface-variant">{label}</dt>
      <dd className="text-body-sm text-on-surface sm:col-span-2">{children ?? "—"}</dd>
    </div>
  );
}

/** Titled card holding a list of <Row>s (admin detail pages). */
export function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl bg-surface-container-lowest p-lg shadow-sm">
      <h2 className="mb-sm flex items-center gap-sm text-headline-md text-on-surface">
        <Icon name={icon} className="text-icon-xl text-primary" />
        {title}
      </h2>
      <dl className="divide-y divide-surface-container-high">{children}</dl>
    </section>
  );
}
