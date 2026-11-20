"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import { cafePalette } from "@/lib/cafes/theme";

/** Phone-sized preview of the café menu header in the café's colours. */
export function MenuPreview({
  name,
  host,
  seed,
  currency,
}: {
  name: string;
  host: string;
  seed: string;
  currency: string;
}) {
  const c = useMemo(() => cafePalette(seed), [seed]);
  const t = useTranslations("fields");
  const locale = useLocale();
  const price = new Intl.NumberFormat(locale === "ar" ? "ar-TN" : locale, {
    style: "currency",
    currency,
  }).format;
  const [espresso, cappuccino] = t("sampleItems").split("|");
  return (
    <div
      aria-label={t("menuPreview")}
      className="mx-auto w-full max-w-64 overflow-hidden rounded-2xl border-4 border-inverse-surface shadow-card-warm"
      style={{ backgroundColor: c.surface }}
    >
      <div className="px-md pt-md pb-lg" style={{ backgroundColor: c.primary, color: c.onPrimary }}>
        <p className="text-caption opacity-80">{host}</p>
        <p className="text-headline-md font-bold">{name}</p>
      </div>
      <div className="-mt-sm flex gap-xs px-md">
        {t("sampleCategories")
          .split("|")
          .map((cat, i) => (
            <span
              key={cat}
              className="rounded-full px-sm py-xs text-caption font-semibold shadow-sm"
              style={
                i === 0
                  ? { backgroundColor: c.container, color: c.onContainer }
                  : { backgroundColor: c.variant, color: c.onVariant }
              }
            >
              {cat}
            </span>
          ))}
      </div>
      <div className="flex flex-col gap-sm p-md">
        {[
          [espresso, 4.5],
          [cappuccino, 6],
        ].map(([item, p]) => (
          <div
            key={item as string}
            className="flex items-center justify-between rounded-lg p-sm"
            style={{ backgroundColor: c.variant, color: c.onSurface }}
          >
            <span>
              <span className="block text-body-sm font-semibold">{item}</span>
              <span className="block text-caption" style={{ color: c.onVariant }}>
                {price(p as number)}
              </span>
            </span>
            <span
              className="rounded-lg px-sm py-xs text-caption font-bold"
              style={{ backgroundColor: c.primary, color: c.onPrimary }}
            >
              {t("add")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
