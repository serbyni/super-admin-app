/** Time zone used to show dates in the platform/admin UI (main market). */
export const PLATFORM_TIME_ZONE = "Africa/Tunis";

const dateTime = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: PLATFORM_TIME_ZONE,
});

export function formatDateTime(iso: string | null | undefined): string {
  return iso ? dateTime.format(new Date(iso)) : "—";
}
