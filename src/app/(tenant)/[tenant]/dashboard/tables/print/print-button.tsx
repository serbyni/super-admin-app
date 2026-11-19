"use client";

import { Icon } from "@/components/ui/icon";

export function PrintButton({ count, noun = "card" }: { count: number; noun?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      disabled={count === 0}
      className="inline-flex items-center gap-xs rounded-xl bg-primary px-md py-sm text-body-sm font-semibold text-on-primary shadow-button-warm hover:bg-primary-container disabled:opacity-60"
    >
      <Icon name="print" className="text-icon-md" /> Print {count}{" "}
      {`${noun}${count === 1 ? "" : "s"}`}
    </button>
  );
}
