import { z } from "zod";

/*
 * Opening hours of a café (Settings → Opening hours; cafes.opening_hours). Used by ordering
 * (platform.cafe_open_now) and the website footer. null = no fixed hours (always open).
 * cafe-app keeps a copy of daySchema / groupHours (lib/website/schema.ts) — keep them in sync.
 */

/** Monday first. */
export const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");

/** One day; a closing time before the opening time means "past midnight" (e.g. 18:00–02:00). */
export const daySchema = z
  .object({ closed: z.boolean(), open: time, close: time })
  .refine((d) => d.closed || d.open !== d.close, {
    path: ["close"],
    message: "Closing time must differ from opening time",
  });
export type OpeningDay = z.infer<typeof daySchema>;

/** 7 days, Monday first. */
export const hoursSchema = z.array(daySchema).length(7);
export type OpeningHours = OpeningDay[];

/** Starting point when the owner sets hours: Mon–Fri 08:00–20:00, Sat–Sun 09:00–20:00. */
export const defaultHours = (): OpeningHours =>
  WEEKDAYS.map((_, i) => ({ closed: false, open: i < 5 ? "08:00" : "09:00", close: "20:00" }));

/** Stored value → hours, or null (none set / unreadable). */
export function parseHours(raw: unknown): OpeningHours | null {
  const r = hoursSchema.safeParse(raw);
  return r.success ? r.data : null;
}

/**
 * Consecutive days with the same hours, e.g. [{ days: "Monday – Friday", hours: "08:00 – 20:00" }].
 * `labels` translates the day names and "Closed" (default English).
 */
export function groupHours(
  hours: OpeningDay[],
  labels: { days: readonly string[]; closed: string } = { days: WEEKDAYS, closed: "Closed" },
): { days: string; hours: string }[] {
  const label = (d: OpeningDay) => (d.closed ? labels.closed : `${d.open} – ${d.close}`);
  const out: { from: number; to: number; hours: string }[] = [];
  hours.forEach((d, i) => {
    const last = out.at(-1);
    if (last && last.hours === label(d)) last.to = i;
    else out.push({ from: i, to: i, hours: label(d) });
  });
  return out.map((g) => ({
    days: g.from === g.to ? labels.days[g.from] : `${labels.days[g.from]} – ${labels.days[g.to]}`,
    hours: g.hours,
  }));
}
