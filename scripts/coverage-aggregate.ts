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
  lines: CoverageMetric;
  statements: CoverageMetric;
  functions: CoverageMetric;
  branches: CoverageMetric;
}

const PACKAGES = [
  "packages/auth",
  "packages/automation",
  "packages/db",
  "packages/email",
  "packages/graph",
  "packages/shared",
  "apps/web",
  "apps/worker",
];

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

  if (missing.length > 0) {
    console.warn(
      "Skipped packages without coverage data:\n  " + missing.join("\n  "),
    );
  }

  const agg = aggregate(reports);

  const outDir = resolve(ROOT, "coverage");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  writeFileSync(
    resolve(outDir, "aggregated-summary.json"),
    JSON.stringify({ ...agg, missingPackages: missing }, null, 2),
  );

  const md = buildMarkdown(agg);
  writeFileSync(resolve(outDir, "aggregated-summary.md"), md);

  console.log(md);
  console.log(
    `\nWrote: coverage/aggregated-summary.json + coverage/aggregated-summary.md`,
  );
}

main();
