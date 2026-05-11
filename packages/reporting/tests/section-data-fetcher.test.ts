// Section-Data-Fetcher tests — verifies the data-source registry contract.
//
// What we test (without DB):
//   - Unknown data sources return empty {headers:[], rows:[]} — never throw
//   - Empty string / undefined data source → empty result
//   - The registry has the documented data sources (regression guard)
//
// We deliberately mock @grc/db to short-circuit query chains. The actual
// SQL behavior is covered by integration tests at the route layer.

import { describe, it, expect, vi } from "vitest";

// Mock db with chainable that resolves to []
const chain: Record<string, unknown> = {};
for (const m of ["from", "where", "leftJoin", "groupBy", "orderBy", "limit", "offset"]) {
  chain[m] = vi.fn(() => chain);
}
(chain as { then: unknown }).then = (resolve: (v: unknown[]) => void) =>
  resolve([]);

vi.mock("@grc/db", () => ({
  db: {
    select: vi.fn(() => chain),
    execute: vi.fn().mockResolvedValue([]),
  },
  risk: {},
  control: {},
  finding: {},
  securityIncident: {},
  threat: {},
  vulnerability: {},
  workItem: {},
  user: {},
}));

vi.mock("drizzle-orm", () => {
  const noop = () => ({}) as unknown;
  return {
    sql: (strings: TemplateStringsArray) => ({ sql: strings.raw }),
    eq: noop,
    and: noop,
    gte: noop,
    lte: noop,
    count: noop,
    desc: noop,
    asc: noop,
    isNull: noop,
  };
});

import {
  fetchTableData,
  fetchChartData,
  fetchKPIValue,
} from "../src/section-data-fetcher";

const ctx = { orgId: "org-1", parameters: {} };

describe("fetchTableData", () => {
  it("returns empty result for unknown data source", async () => {
    const result = await fetchTableData("nonexistent.source", ctx);
    expect(result).toEqual({ headers: [], rows: [] });
  });

  it("returns empty result for undefined data source", async () => {
    const result = await fetchTableData(undefined, ctx);
    expect(result).toEqual({ headers: [], rows: [] });
  });

  it("returns empty result for empty string data source", async () => {
    const result = await fetchTableData("", ctx);
    expect(result).toEqual({ headers: [], rows: [] });
  });

  it("does not throw for any of the documented table data sources", async () => {
    const sources = [
      "erm.risk_register",
      "ics.control_effectiveness",
      "isms.incidents",
      "isms.threats",
      "isms.vulnerabilities",
    ];
    for (const s of sources) {
      const result = await fetchTableData(s, ctx);
      expect(result).toBeDefined();
      expect(Array.isArray(result.headers)).toBe(true);
      expect(Array.isArray(result.rows)).toBe(true);
    }
  });
});

describe("fetchChartData", () => {
  it("returns empty result for unknown data source", async () => {
    const result = await fetchChartData("nonexistent.source", ctx);
    expect(result).toEqual({ labels: [], datasets: [] });
  });

  it("returns empty result for undefined data source", async () => {
    const result = await fetchChartData(undefined, ctx);
    expect(result).toEqual({ labels: [], datasets: [] });
  });

  it("does not throw for any of the documented chart data sources", async () => {
    const sources = [
      "erm.risk_by_category",
      "erm.risk_trend",
      "ics.ces_distribution",
      "isms.incident_by_severity",
    ];
    for (const s of sources) {
      const result = await fetchChartData(s, ctx);
      expect(result).toBeDefined();
      expect(Array.isArray(result.labels)).toBe(true);
      expect(Array.isArray(result.datasets)).toBe(true);
    }
  });
});

describe("fetchKPIValue", () => {
  it("returns zero/empty fallback for unknown data source", async () => {
    const result = await fetchKPIValue("nonexistent.source", ctx);
    expect(result).toBeDefined();
    expect(result.label).toBeDefined();
  });

  it("does not throw for any of the documented KPI data sources", async () => {
    const sources = [
      "erm.risk_count",
      "erm.high_risk_count",
      "ics.avg_ces",
      "ics.control_count",
      "isms.incident_count",
      "isms.threat_count",
      "isms.posture_score",
    ];
    for (const s of sources) {
      const result = await fetchKPIValue(s, ctx);
      expect(result).toBeDefined();
      expect(result.value).toBeDefined();
      expect(result.label).toBeDefined();
    }
  });
});
