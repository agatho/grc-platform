// Unit tests for date, number, and percentage formatting helpers (S1-20)
// Conventions per CLAUDE.md:
//   DE: dd.MM.yyyy / 1.234,56
//   EN: MM/dd/yyyy / 1,234.56

import { describe, it, expect } from "vitest";
import {
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercent,
} from "@/lib/format";

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------

describe("formatDate", () => {
  it("formats date in German locale (de)", () => {
    const result = formatDate("2026-03-25", "de");
    expect(result).toBe("25.03.2026");
  });

  it("formats date in English locale (en)", () => {
    const result = formatDate("2026-03-25", "en");
    expect(result).toBe("03/25/2026");
  });

  it("defaults to German locale when locale is omitted", () => {
    const result = formatDate("2026-03-25");
    expect(result).toBe("25.03.2026");
  });

  it("handles Date objects", () => {
    // Use UTC date to avoid timezone issues
    const date = new Date("2026-12-31T12:00:00Z");
    const result = formatDate(date, "de");
    expect(result).toMatch(/31\.12\.2026/);
  });

  it("pads single-digit day and month with zeros (de)", () => {
    const result = formatDate("2026-01-05", "de");
    expect(result).toBe("05.01.2026");
  });

  it("pads single-digit day and month with zeros (en)", () => {
    const result = formatDate("2026-01-05", "en");
    expect(result).toBe("01/05/2026");
  });

  it("handles end-of-year date", () => {
    const result = formatDate("2026-12-31", "de");
    expect(result).toBe("31.12.2026");
  });

  it("falls back to German for unknown locale", () => {
    const result = formatDate("2026-03-25", "fr");
    // Should use de-DE fallback
    expect(result).toBe("25.03.2026");
  });

  it("handles leap year date", () => {
    const result = formatDate("2028-02-29", "en");
    expect(result).toBe("02/29/2028");
  });
});

// ---------------------------------------------------------------------------
// formatDateTime
// ---------------------------------------------------------------------------

describe("formatDateTime", () => {
  it("formats date+time in German locale (de)", () => {
    const result = formatDateTime("2026-03-25T14:30:00", "de");
    // DE: dd.MM.yyyy HH:mm
    expect(result).toMatch(/25\.03\.2026/);
    expect(result).toMatch(/14:30/);
  });

  it("formats date+time in English locale (en)", () => {
    const result = formatDateTime("2026-03-25T14:30:00", "en");
    // EN: MM/dd/yyyy h:mm AM/PM
    expect(result).toMatch(/03\/25\/2026/);
    expect(result).toMatch(/2:30\s*PM/i);
  });

  it("defaults to German locale", () => {
    const result = formatDateTime("2026-03-25T09:00:00");
    expect(result).toMatch(/25\.03\.2026/);
    expect(result).toMatch(/09:00/);
  });

  it("handles midnight in German locale", () => {
    const result = formatDateTime("2026-03-25T00:00:00", "de");
    expect(result).toMatch(/25\.03\.2026/);
    expect(result).toMatch(/00:00/);
  });

  it("handles midnight in English locale", () => {
    const result = formatDateTime("2026-03-25T00:00:00", "en");
    expect(result).toMatch(/03\/25\/2026/);
    expect(result).toMatch(/12:00\s*AM/i);
  });

  it("handles noon in English locale", () => {
    const result = formatDateTime("2026-03-25T12:00:00", "en");
    expect(result).toMatch(/03\/25\/2026/);
    expect(result).toMatch(/12:00\s*PM/i);
  });

  it("handles Date object input", () => {
    const date = new Date(2026, 2, 25, 14, 30); // March 25, 2026, 14:30 local
    const result = formatDateTime(date, "de");
    expect(result).toMatch(/25\.03\.2026/);
    expect(result).toMatch(/14:30/);
  });

  it("includes both date and time parts in output", () => {
    const result = formatDateTime("2026-06-15T16:45:00", "de");
    // Should contain date separator and time
    expect(result).toContain(".");
    expect(result).toContain(":");
  });
});

// ---------------------------------------------------------------------------
// formatNumber
// ---------------------------------------------------------------------------

describe("formatNumber", () => {
  it("formats number with German grouping and decimal (de)", () => {
    const result = formatNumber(1234.56, "de");
    expect(result).toBe("1.234,56");
  });

  it("formats number with English grouping and decimal (en)", () => {
    const result = formatNumber(1234.56, "en");
    expect(result).toBe("1,234.56");
  });

  it("defaults to German locale", () => {
    const result = formatNumber(1234.56);
    expect(result).toBe("1.234,56");
  });

  it("formats zero", () => {
    const result = formatNumber(0, "de");
    expect(result).toBe("0");
  });

  it("formats negative numbers (de)", () => {
    const result = formatNumber(-1234.56, "de");
    expect(result).toMatch(/-?1\.234,56/);
  });

  it("formats negative numbers (en)", () => {
    const result = formatNumber(-1234.56, "en");
    expect(result).toMatch(/-?1,234\.56/);
  });

  it("formats large numbers with grouping (de)", () => {
    const result = formatNumber(1000000, "de");
    expect(result).toBe("1.000.000");
  });

  it("formats large numbers with grouping (en)", () => {
    const result = formatNumber(1000000, "en");
    expect(result).toBe("1,000,000");
  });

  it("formats small numbers without grouping", () => {
    const result = formatNumber(42, "de");
    expect(result).toBe("42");
  });

  it("accepts custom NumberFormat options", () => {
    const result = formatNumber(0.856, "en", {
      style: "percent",
    });
    // With percent style, 0.856 becomes 86%
    expect(result).toContain("86");
    expect(result).toContain("%");
  });

  it("formats decimals with trailing zeros when configured", () => {
    const result = formatNumber(100, "de", {
      minimumFractionDigits: 2,
    });
    expect(result).toBe("100,00");
  });

  it("handles very small decimal numbers (de)", () => {
    const result = formatNumber(0.01, "de");
    expect(result).toBe("0,01");
  });

  it("handles very small decimal numbers (en)", () => {
    const result = formatNumber(0.01, "en");
    expect(result).toBe("0.01");
  });
});

// ---------------------------------------------------------------------------
// formatPercent
// ---------------------------------------------------------------------------

describe("formatPercent", () => {
  it("formats percentage in German locale", () => {
    const result = formatPercent(85.5, "de");
    // DE: uses non-breaking space before % sign, value is 85,5 %
    // The Intl formatter receives 0.855 (85.5/100) and formats as percent
    expect(result).toMatch(/85,5/);
    expect(result).toContain("%");
  });

  it("formats percentage in English locale", () => {
    const result = formatPercent(85.5, "en");
    // EN: 85.5%
    expect(result).toMatch(/85\.5/);
    expect(result).toContain("%");
  });

  it("defaults to German locale", () => {
    const result = formatPercent(50);
    expect(result).toContain("50");
    expect(result).toContain("%");
  });

  it("formats 0%", () => {
    const result = formatPercent(0, "de");
    expect(result).toMatch(/0/);
    expect(result).toContain("%");
  });

  it("formats 100%", () => {
    const result = formatPercent(100, "de");
    expect(result).toMatch(/100/);
    expect(result).toContain("%");
  });

  it("formats integer percentages without unnecessary decimals", () => {
    const result = formatPercent(75, "en");
    // Should be "75%" without decimal
    expect(result).toMatch(/75\s*%/);
  });

  it("formats fractional percentages (de)", () => {
    const result = formatPercent(33.3, "de");
    expect(result).toMatch(/33,3/);
    expect(result).toContain("%");
  });

  it("formats fractional percentages (en)", () => {
    const result = formatPercent(33.3, "en");
    expect(result).toMatch(/33\.3/);
    expect(result).toContain("%");
  });

  it("handles very small percentages", () => {
    const result = formatPercent(0.1, "en");
    expect(result).toMatch(/0\.1/);
    expect(result).toContain("%");
  });

  it("handles values over 100%", () => {
    const result = formatPercent(150, "en");
    expect(result).toMatch(/150/);
    expect(result).toContain("%");
  });
});
