import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";

/** Centered card with a badge icon, title and body — used by check-email and pending pages. */
export function StatusCard({
  icon,
  eyebrow,
  title,
  children,
}: {
  icon: string;
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-card-md">
      <div className="flex flex-col gap-lg rounded-xl bg-surface-container-lowest/90 p-8 shadow-card-warm backdrop-blur-xl sm:p-10">
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-md flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-secondary-container to-surface-container shadow-md">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-container text-surface-container-lowest">
              <Icon name={icon} filled className="text-icon-2xl" />
            </div>
          </div>
          <span className="mb-xs font-label-sm text-label-sm tracking-widest text-primary uppercase">
            {eyebrow}
          </span>
          <h1 className="text-headline-md font-bold tracking-tight text-primary">{title}</h1>
        </div>
        {children}
      </div>
    </div>
  );
}
