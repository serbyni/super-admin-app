"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { cafeUrl } from "@/lib/env";

const STYLES = {
  /** Outlined button, e.g. in a page header. */
  button:
    "inline-flex items-center justify-center gap-xs rounded-xl border border-outline-variant bg-surface-container-lowest px-md py-sm text-body-sm font-semibold text-primary hover:bg-secondary-container",
  /** Inline text link, e.g. the café address in a table or card. */
  inline:
    "inline-flex items-center gap-xs font-semibold text-primary underline-offset-2 hover:underline",
} as const;

/** Link to a café's public page (cafe-app, <slug>.<root>), opened in a new tab. */
export function CafePageLink({
  slug,
  variant = "button",
  children,
  className = "",
}: {
  slug: string;
  variant?: keyof typeof STYLES;
  children?: ReactNode;
  className?: string;
}) {
  const t = useTranslations("common");
  return (
    <a
      href={cafeUrl(slug)}
      target="_blank"
      rel="noopener noreferrer"
      className={`${STYLES[variant]} ${className}`}
    >
      {children ?? t("openCafePage")}
      <Icon name="open_in_new" className="text-icon-md" />
      <span className="sr-only">{t("opensInNewTab")}</span>
    </a>
  );
}
