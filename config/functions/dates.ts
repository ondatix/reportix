/**
 * Date-related column transforms for this project's config.
 *
 * These are referenced by name from `preprocessing.mutations[].fn` in
 * `config/data.yaml`. They live here rather than in `src/` so the app's
 * modules stay domain-free: adding a derivation means adding a function here
 * and naming it in the YAML — see `src/modules/transforms/` for the contract.
 *
 * Every named function exported from `config/functions/*.ts` is registered
 * automatically, so keep helpers unexported (or export them as constants).
 */
import type { ColumnTransform } from "../../src/modules/transforms";
import { resolveDateValue } from "../../src/modules/shared/dates";

/**
 * Whole days between two date columns: `from: [end, start]` → `end - start`.
 *
 * Accepts what a spreadsheet actually yields: a `Date`, an ISO string, a
 * German `TT.MM.JJJJ` string, or an Excel serial number. A row whose dates do
 * not both parse gets `""` (an empty cell — skipped by every aggregation)
 * rather than a misleading `0`.
 *
 * Options:
 *   `inclusive: true`        count both endpoints (adds 1 day)
 *   `clamp_start`,           trim each span to the reporting period before
 *   `clamp_end`              measuring it: a start before `clamp_start` counts
 *                            from that day, an end after `clamp_end` counts to
 *                            that day. A span lying entirely outside the period
 *                            yields `""`, not 0 — it contributes no row rather
 *                            than a zero that would drag a mean down.
 *   `min`, `max`             clamp the resulting number of days, e.g. `min: 0`
 *                            to drop negative spans (end before start)
 */
export const date_difference: ColumnTransform = (columns, ctx) => {
  const [ends = [], starts = []] = columns;
  const inclusive = ctx.options.inclusive === true;
  const min = typeof ctx.options.min === "number" ? ctx.options.min : undefined;
  const max = typeof ctx.options.max === "number" ? ctx.options.max : undefined;
  // Resolved first, so the period may be given as a relative token
  // (`last_year_start`) exactly like in `data_parameters`.
  const clampStart = toDate(resolveDateValue(ctx.options.clamp_start));
  const clampEnd = toDate(resolveDateValue(ctx.options.clamp_end));

  return Array.from({ length: ctx.rowCount }, (_, i) => {
    let end = toDate(ends[i]);
    let start = toDate(starts[i]);
    if (end === undefined || start === undefined) return "";

    // Trim to the reporting period. Checked before clamping, so a span that
    // never touches the period is reported as absent rather than as 0 days.
    if (clampStart !== undefined && end < clampStart) return "";
    if (clampEnd !== undefined && start > clampEnd) return "";
    if (clampStart !== undefined) start = Math.max(start, clampStart);
    if (clampEnd !== undefined) end = Math.min(end, clampEnd);

    let days = Math.round((end - start) / MS_PER_DAY) + (inclusive ? 1 : 0);
    if (min !== undefined) days = Math.max(min, days);
    if (max !== undefined) days = Math.min(max, days);
    return days;
  });
};

const MS_PER_DAY = 86_400_000;

/** Excel's day 0 is 1899-12-30 (its calendar has a phantom 1900-02-29). */
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

/** Parse a spreadsheet cell into a UTC timestamp, or `undefined` if it isn't a date. */
function toDate(value: unknown): number | undefined {
  if (value instanceof Date) return utcMidnight(value.getFullYear(), value.getMonth(), value.getDate());

  // Excel serial: a plain number of days since the epoch above. Bounded to a
  // plausible range so a stray count (e.g. 5) is not read as January 1900.
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value < 1000 || value > 200_000) return undefined;
    return EXCEL_EPOCH + Math.floor(value) * MS_PER_DAY;
  }

  if (typeof value !== "string") return undefined;
  const text = value.trim();
  if (text === "") return undefined;

  // TT.MM.JJJJ — the format the source systems export.
  const german = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(text);
  if (german) {
    const [, d, m, y] = german;
    return utcMidnight(Number(y), Number(m) - 1, Number(d));
  }

  // JJJJ-MM-TT, with or without a time part.
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (iso) {
    const [, y, m, d] = iso;
    return utcMidnight(Number(y), Number(m) - 1, Number(d));
  }

  return undefined;
}

/** UTC midnight, rejecting overflowing components (31.02. must not become 03.03.). */
function utcMidnight(year: number, month: number, day: number): number | undefined {
  const ts = Date.UTC(year, month, day);
  const back = new Date(ts);
  if (back.getUTCFullYear() !== year || back.getUTCMonth() !== month || back.getUTCDate() !== day) {
    return undefined;
  }
  return ts;
}
