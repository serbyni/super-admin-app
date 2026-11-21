import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { formatLocale } from "@/config/locale";
import { PERIODS, type Period, type PeriodKey } from "@/lib/stats/period";

/** "15–21 Nov 2026" style range (yyyy-mm-dd dates, shown as calendar days). */
export function formatRange(a: string, b: string, locale: string) {
  const f = new Intl.DateTimeFormat(formatLocale(locale), { dateStyle: "medium", timeZone: "UTC" });
  const d = (x: string) => new Date(`${x}T00:00:00Z`);
  return a === b ? f.format(d(a)) : f.formatRange(d(a), d(b));
}

const short = (x: string, locale: string) =>
  new Intl.DateTimeFormat(formatLocale(locale), {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${x}T00:00:00Z`));

/**
 * Period picker shared by the statistics: quick periods (links) + custom range (GET form), and
 * the "1–7 Nov · vs 25–31 Oct" line. `fallback` is the period of the bare URL; `keep` = other
 * query parameters to keep (e.g. view=history).
 */
export async function PeriodBar({
  period,
  today,
  base,
  locale,
  fallback = "7d",
  keep = {},
}: {
  period: Period;
  today: string;
  base: string;
  locale: string;
  fallback?: PeriodKey;
  keep?: Record<string, string>;
}) {
  const t = await getTranslations("stats");
  const href = (p: PeriodKey) => {
    const q = new URLSearchParams(keep);
    if (p !== fallback) q.set("period", p);
    const s = q.toString();
    return s ? `${base}?${s}` : base;
  };
  return (
    <div className="flex flex-col gap-sm">
      <div className="flex flex-wrap items-end gap-sm">
        <nav
          aria-label={t("periodLabel")}
          className="flex gap-xs rounded-full bg-surface-container p-0.5"
        >
          {PERIODS.filter((p) => p !== "custom").map((p) => (
            <Link
              key={p}
              href={href(p)}
              scroll={false}
              aria-current={period.key === p ? "page" : undefined}
              className={`rounded-full px-md py-xs text-body-sm font-semibold ${
                period.key === p
                  ? "bg-surface-container-lowest text-on-surface shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {t(`periods.${p}`)}
            </Link>
          ))}
        </nav>
        <form action={base} className="flex flex-wrap items-end gap-xs">
          {Object.entries(keep).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <input type="hidden" name="period" value="custom" />
          {(
            [
              ["from", t("from"), period.from],
              ["to", t("to"), period.to],
            ] as const
          ).map(([name, label, value]) => (
            <label
              key={name}
              className="flex flex-col gap-xs text-caption font-semibold text-on-surface-variant"
            >
              {label}
              <input
                type="date"
                name={name}
                defaultValue={value}
                max={today}
                required
                className="rounded-lg border border-outline-variant bg-transparent px-sm py-xs text-body-sm font-normal text-on-surface"
              />
            </label>
          ))}
          <button
            type="submit"
            aria-pressed={period.key === "custom"}
            className={`rounded-xl border px-md py-xs text-body-sm font-semibold ${
              period.key === "custom"
                ? "border-primary bg-secondary-container text-on-secondary-container"
                : "border-outline-variant text-primary hover:bg-secondary-container"
            }`}
          >
            {t("apply")}
          </button>
        </form>
      </div>
      <p className="text-body-sm text-on-surface-variant">
        <span className="font-semibold text-on-surface">
          {period.key === "today"
            ? t("periods.today")
            : formatRange(period.from, period.to, locale)}
        </span>{" "}
        ·{" "}
        {t("vsPrevious", {
          from: short(period.prevFrom, locale),
          to: short(period.prevTo, locale),
        })}
      </p>
    </div>
  );
}
