/**
 * Relative date tokens for config values.
 *
 * A config file is bundled at build time, so a literal date in it ages: the
 * reporting period default would have to be edited by hand every January. A
 * token like `last_year_start` is resolved instead — against the current date
 * when the config is parsed, so a report generated in 2027 defaults to 2026
 * with no edit.
 *
 * Deliberately a closed set of tokens, not an expression language: these are
 * the periods a yearly report actually uses, and anything unrecognised passes
 * through untouched so explicit `YYYY-MM-DD` dates keep working.
 */

/** The tokens understood in a date-valued config field. */
export const DATE_TOKENS = [
  "last_year_start",
  "last_year_end",
  "this_year_start",
  "this_year_end",
  "today",
] as const;

export type DateToken = (typeof DATE_TOKENS)[number];

/** `YYYY-MM-DD` for a UTC y/m/d triple. */
function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Resolve a date-valued config entry.
 *
 * A recognised token becomes a `YYYY-MM-DD` string; any other string is
 * returned trimmed (so literal dates pass through); anything else — including
 * `undefined` — yields `undefined`.
 *
 * `now` is injectable so callers (and tests) are not at the mercy of the
 * clock; it defaults to the current date. The year is read in **local** time,
 * matching the calendar the user is looking at.
 */
export function resolveDateValue(value: unknown, now: Date = new Date()): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  if (text === "") return undefined;

  const year = now.getFullYear();
  switch (text as DateToken) {
    case "last_year_start":
      return iso(year - 1, 1, 1);
    case "last_year_end":
      return iso(year - 1, 12, 31);
    case "this_year_start":
      return iso(year, 1, 1);
    case "this_year_end":
      return iso(year, 12, 31);
    case "today":
      return iso(year, now.getMonth() + 1, now.getDate());
    default:
      return text;
  }
}
