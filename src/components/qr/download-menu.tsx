"use client";

import { useTranslations } from "next-intl";
import { useRef } from "react";
import { Icon } from "@/components/ui/icon";

export type QrDownloadKind = "card-png" | "card-svg" | "sticker-png" | "sticker-svg";

const OPTIONS = [
  { kind: "card-png", label: "cardPng", hint: "cardPngHint" },
  { kind: "card-svg", label: "cardSvg", hint: "cardSvgHint" },
  { kind: "sticker-png", label: "stickerPng", hint: "stickerPngHint" },
  { kind: "sticker-svg", label: "stickerSvg", hint: "stickerSvgHint" },
] as const satisfies { kind: QrDownloadKind; label: string; hint: string }[];

/**
 * "Download" button with the size/format choice (native <details>: keyboard friendly, no JS
 * needed to open). Closes after a choice.
 */
export function QrDownloadMenu({
  onPick,
  label,
  iconOnly = false,
  name,
}: {
  onPick: (kind: QrDownloadKind) => void;
  label?: string;
  iconOnly?: boolean;
  /** For the accessible name of an icon-only button, e.g. "T7". */
  name?: string;
}) {
  const t = useTranslations("qrDownload");
  const ref = useRef<HTMLDetailsElement>(null);
  return (
    <details ref={ref} className="group relative">
      <summary
        aria-label={iconOnly ? (name ? t("downloadQrOf", { name }) : t("downloadQr")) : undefined}
        title={iconOnly ? t("downloadQr") : undefined}
        className={`no-marker flex cursor-pointer list-none items-center gap-xs font-semibold text-primary hover:bg-secondary-container ${
          iconOnly
            ? "h-9 w-9 justify-center rounded-lg text-on-surface-variant"
            : "rounded-xl border border-outline-variant px-md py-sm text-body-sm"
        }`}
      >
        <Icon name="download" className={iconOnly ? "text-icon-lg" : "text-icon-md"} />
        {iconOnly ? null : (
          <>
            {label ?? t("download")}
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
              <span className="text-body-sm font-semibold text-on-surface">{t(o.label)}</span>
              <span className="text-caption text-on-surface-variant">{t(o.hint)}</span>
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
