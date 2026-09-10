#!/usr/bin/env tsx
/**
 * Coverage Aggregator
 *
 * Reads `coverage/coverage-summary.json` from every package + app,
 * aggregates statements / branches / functions / lines into a single
 * report, writes:
 *
 *   - coverage/aggregated-summary.json   (machine readable)
 *   - coverage/aggregated-summary.md     (markdown for PR comments)
 *
 * Usage:
 *   npm run test:coverage         # runs every package's vitest with --coverage
 *   tsx scripts/coverage-aggregate.ts
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { COVERAGE_FLOORS } from "../vitest.coverage.shared";

interface CoverageMetric {
  total: number;
  covered: number;
  skipped: number;
  pct: number;
}

interface CoverageSummary {
  total: {
    lines: CoverageMetric;
    statements: CoverageMetric;
    functions: CoverageMetric;
    branches: CoverageMetric;
  };
}

interface PackageReport {
  name: string;
  path: string;
  minLines: number;
  minBranches: number;
  lines: CoverageMetric;
  statements: CoverageMetric;
  functions: CoverageMetric;
  branches: CoverageMetric;
}

// [ARCTOS-FULL-2026-08-31 / WP11 · S11-16, S11-14]
//
// The list used to hold 8 entries and silently omitted `packages/events`,
// `packages/reporting`, `packages/ai` and `packages/ui` — four packages with
// tests whose numbers therefore never reached the aggregate. `packages/db`
// was listed but had no coverage block in its vitest config and so never
// wrote a summary; a missing summary was only a `console.warn`.
//
// Now: the package list and the floors both come from `COVERAGE_FLOORS` in
// `vitest.coverage.shared.ts` — one source of truth shared with the per-package
// vitest configs, so the two can no longer disagree. A missing summary is a
// hard error: the aggregate silently shrinking to the two best-covered
// packages is exactly how docs/STATUS.md came to claim 78.4 % while the real
// figure was 20.4 % (S11-01).

const PACKAGES: string[] = Object.keys(COVERAGE_FLOORS);

const ROOT = resolve(__dirname, "..");

function loadPackage(p: string): PackageReport | null {
  const summaryPath = resolve(ROOT, p, "coverage", "coverage-summary.json");
  if (!existsSync(summaryPath)) {
    return null;
  }
  try {
    const raw = readFileSync(summaryPath, "utf-8");
    const json = JSON.parse(raw) as CoverageSummary;
    return {
      name: p,
      path: summaryPath,
      minLines: COVERAGE_FLOORS[p]!.lines,
      minBranches: COVERAGE_FLOORS[p]!.branches,
      lines: json.total.lines,
      statements: json.total.statements,
      functions: json.total.functions,
      branches: json.total.branches,
    };
  } catch {
    return null;
  }
}

function aggregate(reports: PackageReport[]): {
  totals: {
    lines: CoverageMetric;
    statements: CoverageMetric;
    functions: CoverageMetric;
    branches: CoverageMetric;
  };
  perPackage: PackageReport[];
} {
  const sum = (key: keyof PackageReport): CoverageMetric => {
    let total = 0,
      covered = 0,
      skipped = 0;
    for (const r of reports) {
      const m = r[key] as CoverageMetric;
      total += m.total;
      covered += m.covered;
      skipped += m.skipped;
    }
    return {
      total,
      covered,
      skipped,
      pct: total > 0 ? Math.round((covered / total) * 10000) / 100 : 0,
    };
  };
  return {
    totals: {
      lines: sum("lines"),
      statements: sum("statements"),
      functions: sum("functions"),
      branches: sum("branches"),
    },
    perPackage: reports,
  };
}

function pctEmoji(pct: number): string {
  if (pct >= 80) return "🟢";
  if (pct >= 60) return "🟡";
  if (pct >= 40) return "🟠";
  return "🔴";
}

function pctCell(m: CoverageMetric): string {
  return `${pctEmoji(m.pct)} ${m.pct.toFixed(1)}% (${m.covered}/${m.total})`;
}

function buildMarkdown(agg: ReturnType<typeof aggregate>): string {
  const lines: string[] = [];
  lines.push("# Test Coverage Report\n");
  lines.push(
    `_Generated: ${new Date().toISOString().replace("T", " ").slice(0, 19)}_\n`,
  );

  lines.push("## Aggregate (all packages)\n");
  lines.push("| Metric | Coverage |");
  lines.push("|---|---|");
  lines.push(`| Lines      | ${pctCell(agg.totals.lines)} |`);
  lines.push(`| Statements | ${pctCell(agg.totals.statements)} |`);
  lines.push(`| Functions  | ${pctCell(agg.totals.functions)} |`);
  lines.push(`| Branches   | ${pctCell(agg.totals.branches)} |`);
  lines.push("");

  lines.push("## Per-Package Breakdown\n");
  lines.push("| Package | Lines | Statements | Functions | Branches |");
  lines.push("|---|---|---|---|---|");
  for (const r of agg.perPackage) {
    lines.push(
      `| ${r.name} | ${pctCell(r.lines)} | ${pctCell(r.statements)} | ${pctCell(r.functions)} | ${pctCell(r.branches)} |`,
    );
  }
  lines.push("");

  lines.push("## Legend\n");
  lines.push("- 🟢 ≥ 80 %");
  lines.push("- 🟡 60 – 79 %");
  lines.push("- 🟠 40 – 59 %");
  lines.push("- 🔴 < 40 %");
  lines.push("");

  return lines.join("\n");
}

function buildThresholdReport(reports: PackageReport[]): {
  lines: string[];
  violations: string[];
} {
  const out: string[] = [];
  const violations: string[] = [];
  out.push("## Threshold check (per package floor)\n");
  out.push("| Package | Lines | Floor | Branches | Floor | Verdict |");
  out.push("|---|---|---|---|---|---|");
  for (const r of reports) {
    const okLines = r.lines.pct >= r.minLines;
    const okBranches = r.branches.pct >= r.minBranches;
    const ok = okLines && okBranches;
    out.push(
      `| ${r.name} | ${r.lines.pct.toFixed(1)} % | ${r.minLines} % | ` +
        `${r.branches.pct.toFixed(1)} % | ${r.minBranches} % | ` +
        `${ok ? "PASS" : "**FAIL**"} |`,
    );
    if (!okLines) {
      violations.push(
        `${r.name}: lines ${r.lines.pct.toFixed(1)} % < floor ${r.minLines} %`,
      );
    }
    if (!okBranches) {
      violations.push(
        `${r.name}: branches ${r.branches.pct.toFixed(1)} % < floor ${r.minBranches} %`,
      );
    }
  }
  out.push("");
  return { lines: out, violations };
}

function main() {
  const reports: PackageReport[] = [];
  const missing: string[] = [];

  for (const p of PACKAGES) {
    const r = loadPackage(p);
    if (r) {
      reports.push(r);
    } else {
      missing.push(p);
    }
  }

  if (reports.length === 0) {
    console.error(
      "No coverage-summary.json files found. Run `npm run test:coverage` first.",
    );
    process.exit(1);
  }

  const agg = aggregate(reports);
  const thresholds = buildThresholdReport(reports);

  const outDir = resolve(ROOT, "coverage");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  writeFileSync(
    resolve(outDir, "aggregated-summary.json"),
    JSON.stringify(
      {
        ...agg,
        missingPackages: missing,
        thresholdViolations: thresholds.violations,
      },
      null,
      2,
    ),
  );

  const md = buildMarkdown(agg) + thresholds.lines.join("\n") + "\n";
  writeFileSync(resolve(outDir, "aggregated-summary.md"), md);

  console.log(md);
  console.log(
    `\nWrote: coverage/aggregated-summary.json + coverage/aggregated-summary.md`,
  );

  // [WP11 · S11-16] A package without a summary used to be a warning. It is
  // now a failure: the aggregate silently shrinking to the two best-covered
  // packages is precisely how docs/STATUS.md came to claim 78.4 % while the
  // real figure was 20.4 % (S11-01).
  let failed = false;
  if (missing.length > 0) {
    console.error(
      "\nERROR: no coverage-summary.json for:\n  " +
        missing.join("\n  ") +
        "\n  Every workspace listed in PACKAGES must run `test:coverage`.",
    );
    failed = true;
  }
  if (thresholds.violations.length > 0) {
    console.error(
      "\nERROR: coverage below the agreed floor:\n  " +
        thresholds.violations.join("\n  "),
    );
    failed = true;
  }

  if (failed) process.exit(1);
}

main();
