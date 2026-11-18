/**
 * How a privacy-suppressed cell is presented.
 *
 * `<{threshold}` is only truthful where the displayed number *is* the group
 * count. For a mean, a sum or a share it would be a factual lie — a suppressed
 * average salary of 4200 € is not "< 5" — so those render a neutral
 * placeholder instead.
 */
import { describe, it, expect } from "vitest";
import { formatWrangledCell } from "../../src/modules/renderer/table";
import type { WrangledCell } from "../../src/modules/aggregation";
import { t } from "../../src/modules/i18n";

const masked: WrangledCell = { value: 4200, n: 2, protected: true };
const visible: WrangledCell = { value: 4200, n: 20, protected: false };

describe("formatWrangledCell — suppressed cells", () => {
  it("shows `<threshold` for a count, where that is literally true", () => {
    const cell: WrangledCell = { value: 3, n: 3, protected: true };
    expect(formatWrangledCell(cell, { threshold: 5, isShare: false, aggregation: "count" })).toBe("<5");
  });

  it("never claims a suppressed mean is below the threshold", () => {
    const out = formatWrangledCell(masked, { threshold: 5, isShare: false, aggregation: "mean" });
    expect(out).toBe(t("agg.suppressed"));
    expect(out).not.toContain("<5");
    expect(out).not.toContain("4200");
  });

  it("uses the placeholder for sum, median and the share ops too", () => {
    for (const op of ["sum", "median", "min", "max", "share_total", "share_group"] as const) {
      const out = formatWrangledCell(masked, { threshold: 5, isShare: op.startsWith("share"), aggregation: op });
      expect(out, op).toBe(t("agg.suppressed"));
    }
  });

  it("leaves an unprotected cell formatted normally", () => {
    // Locale-dependent grouping, so match the digits rather than the exact string.
    const out = formatWrangledCell(visible, { threshold: 5, isShare: false, aggregation: "mean" });
    expect(out.replace(/\D/g, "")).toContain("4200");
  });
});
