/* Period picker of the dashboard statistics (pure — dates are yyyy-mm-dd in café time). */

export const PERIODS = ["today", "7d", "30d", "custom"] as const;
export type PeriodKey = (typeof PERIODS)[number];
export const MAX_DAYS = 366;

export type Period = {
  key: PeriodKey;
  from: string;
  to: string;
  prevFrom: string;
  prevTo: string;
  days: number;
  hourly: boolean;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

const toMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
const toDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const valid = (d: unknown): d is string =>
  typeof d === "string" && DAY.test(d) && !isNaN(toMs(d)) && toDay(toMs(d)) === d;

/** Adds n days to a yyyy-mm-dd date. */
export const addDays = (d: string, n: number) => toDay(toMs(d) + n * DAY_MS);

/** Today's date (yyyy-mm-dd) in a time zone. */
export const todayIn = (timeZone: string, now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone }).format(now);

function build(key: PeriodKey, from: string, to: string): Period {
  const days = Math.round((toMs(to) - toMs(from)) / DAY_MS) + 1;
  return {
    key,
    from,
    to,
    prevFrom: addDays(from, -days),
    prevTo: addDays(from, -1),
    days,
    hourly: days === 1,
  };
}

/** Reads ?period=today|7d|30d|custom&from=&to=. Missing or invalid → `fallback` (7 days). */
export function resolvePeriod(
  params: { period?: unknown; from?: unknown; to?: unknown },
  today: string,
  fallback: "today" | "7d" | "30d" = "7d",
): Period {
  const key = PERIODS.includes(params.period as PeriodKey)
    ? (params.period as PeriodKey)
    : fallback;
  if (key === "today") return build("today", today, today);
  if (key === "30d") return build("30d", addDays(today, -29), today);
  if (key === "custom" && valid(params.from) && valid(params.to)) {
    const [from, to] =
      params.from <= params.to ? [params.from, params.to] : [params.to, params.from];
    const days = Math.round((toMs(to) - toMs(from)) / DAY_MS) + 1;
    if (days <= MAX_DAYS && to <= today) return build("custom", from, to);
  }
  if (key === "custom") return resolvePeriod({}, today, fallback);
  return build("7d", addDays(today, -6), today);
}

/** % change vs the previous period; null when there is nothing to compare with. */
export function delta(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}
