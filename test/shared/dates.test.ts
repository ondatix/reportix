/**
 * Relative date tokens in config values — resolved against an injected "now",
 * so the expectations do not drift with the clock.
 */
import { describe, it, expect } from "vitest";
import { resolveDateValue } from "../../src/modules/shared/dates";

const now = new Date(2026, 8, 3); // 2026-09-03, local time

describe("resolveDateValue", () => {
  it("resolves the last-year tokens to that calendar year", () => {
    expect(resolveDateValue("last_year_start", now)).toBe("2025-01-01");
    expect(resolveDateValue("last_year_end", now)).toBe("2025-12-31");
  });

  it("resolves the this-year tokens and today", () => {
    expect(resolveDateValue("this_year_start", now)).toBe("2026-01-01");
    expect(resolveDateValue("this_year_end", now)).toBe("2026-12-31");
    expect(resolveDateValue("today", now)).toBe("2026-09-03");
  });

  it("rolls over with the calendar, so a bundled default cannot age", () => {
    expect(resolveDateValue("last_year_start", new Date(2027, 0, 2))).toBe("2026-01-01");
  });

  it("passes a literal date through untouched", () => {
    expect(resolveDateValue("2024-03-01", now)).toBe("2024-03-01");
    expect(resolveDateValue("  2024-03-01  ", now)).toBe("2024-03-01");
  });

  it("yields undefined for a non-string or empty value", () => {
    expect(resolveDateValue(undefined, now)).toBeUndefined();
    expect(resolveDateValue(null, now)).toBeUndefined();
    expect(resolveDateValue(42, now)).toBeUndefined();
    expect(resolveDateValue("   ", now)).toBeUndefined();
  });
});
