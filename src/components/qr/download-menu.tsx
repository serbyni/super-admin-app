"use client";

import { useRef } from "react";
import { Icon } from "@/components/ui/icon";

export type QrDownloadKind = "card-png" | "card-svg" | "sticker-png" | "sticker-svg";

const OPTIONS: { kind: QrDownloadKind; label: string; hint: string }[] = [
  { kind: "card-png", label: "Card · PNG", hint: "Large, ~10×14 cm — stands, counter" },
  { kind: "card-svg", label: "Card · SVG", hint: "Large, for print shops" },
  { kind: "sticker-png", label: "Sticker · PNG", hint: "Small, ~5×6 cm — on the table" },
  { kind: "sticker-svg", label: "Sticker · SVG", hint: "Small, for print shops" },
];

/**
 * "Download" button with the size/format choice (native <details>: keyboard friendly, no JS
 * needed to open). Closes after a choice.
 */
export function QrDownloadMenu({
  onPick,
  label = "Download",
  iconOnly = false,
  name,
}: {
  onPick: (kind: QrDownloadKind) => void;
  label?: string;
  iconOnly?: boolean;
  /** For the accessible name of an icon-only button, e.g. "T7". */
  name?: string;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  return (
    <details ref={ref} className="group relative">
      <summary
        aria-label={iconOnly ? `Download QR code${name ? ` of ${name}` : ""}` : undefined}
        title={iconOnly ? "Download QR code" : undefined}
        className={`no-marker flex cursor-pointer list-none items-center gap-xs font-semibold text-primary hover:bg-secondary-container ${
          iconOnly
            ? "h-9 w-9 justify-center rounded-lg text-on-surface-variant"
            : "rounded-xl border border-outline-variant px-md py-sm text-body-sm"
        }`}
      >
        <Icon name="download" className={iconOnly ? "text-icon-lg" : "text-icon-md"} />
        {iconOnly ? null : (
          <>
            {label}
            <Icon
              name="expand_more"
              className="text-icon-md transition-transform group-open:rotate-180"
            />
          </>
        )}
      </summary>
      <ul className="absolute start-0 z-30 mt-xs w-64 overflow-hidden rounded-xl border border-surface-container-high bg-surface-container-lowest py-xs shadow-card-warm">
        {OPTIONS.map((o) => (
          <li key={o.kind}>
            <button
              type="button"
              onClick={() => {
                if (ref.current) ref.current.open = false;
                onPick(o.kind);
              }}
              className="flex w-full flex-col items-start px-md py-sm text-start hover:bg-surface-container-low"
            >
              <span className="text-body-sm font-semibold text-on-surface">{o.label}</span>
              <span className="text-caption text-on-surface-variant">{o.hint}</span>
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
