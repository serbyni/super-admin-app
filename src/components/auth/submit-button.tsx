"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Icon } from "@/components/ui/icon";

export function SubmitButton({
  icon,
  pendingLabel,
  children,
}: {
  icon: string;
  pendingLabel: string;
  children: ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-sm flex w-full cursor-pointer items-center justify-center gap-sm rounded-xl bg-primary py-md text-body-md font-bold text-on-primary shadow-md transition-all duration-200 hover:scale-101 hover:bg-primary/90 active:scale-99 disabled:cursor-wait disabled:opacity-70"
    >
      <Icon
        name={pending ? "progress_activity" : icon}
        className={`text-icon-lg ${pending ? "animate-spin" : ""}`}
      />
      <span>{pending ? pendingLabel : children}</span>
    </button>
  );
}
