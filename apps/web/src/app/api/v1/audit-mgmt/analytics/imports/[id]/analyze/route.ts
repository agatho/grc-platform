import { db, auditAnalyticsImport, auditAnalyticsResult } from "@grc/db";
import { requireModule } from "@grc/auth";
import { runAnalysisSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/audit-mgmt/analytics/imports/:id/analyze — Run analysis
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const body = await req.json();
  const parsed = runAnalysisSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Fetch import data
  const [importRow] = await db
    .select()
    .from(auditAnalyticsImport)
    .where(
      and(
        eq(auditAnalyticsImport.id, id),
        eq(auditAnalyticsImport.orgId, ctx.orgId),
      ),
    );

  if (!importRow) {
    return Response.json({ error: "Import not found" }, { status: 404 });
  }

  const data = importRow.dataJson as Record<string, unknown>[];
  const { analysisType, config } = parsed.data;

  let resultJson: Record<string, unknown> = {};
  let summaryJson: {
    flaggedCount: number;
    totalAnalyzed: number;
    significance: boolean;
  } = {
    flaggedCount: 0,
    totalAnalyzed: data.length,
    significance: false,
  };

  switch (analysisType) {
    case "benford": {
      const field = config.field ?? "amount";
      const values = data
        .map((r) => Number(r[field]))
        .filter((v) => !isNaN(v) && v > 0);

      if (values.length < (config.minCount ?? 100)) {
        return Response.json(
          {
            error: `Minimum ${config.minCount ?? 100} valid numeric values required for Benford analysis`,
          },
          { status: 400 },
        );
      }

      const result = benfordAnalysis(values);
      resultJson = result as unknown as Record<string, unknown>;
      summaryJson = {
        flaggedCount: result.flaggedDigits.length,
        totalAnalyzed: values.length,
        significance: result.significant,
      };
      break;
    }
    case "duplicate": {
      const matchFields = config.matchFields ?? [];
      const threshold = (config.threshold ?? 85) / 100;
      const pairs = detectDuplicates(data, matchFields, threshold);
      resultJson = { pairs } as unknown as Record<string, unknown>;
      summaryJson = {
        flaggedCount: pairs.length,
        totalAnalyzed: data.length,
        significance: pairs.length > 0,
      };
      break;
    }
    case "outlier": {
      const field = config.field ?? "amount";
      const values = data.map((r) => Number(r[field])).filter((v) => !isNaN(v));
      const result = detectOutliers(
        values,
        (config.method as "zscore" | "iqr") ?? "zscore",
        config.threshold ?? 3,
      );
      resultJson = result as unknown as Record<string, unknown>;
      summaryJson = {
        flaggedCount: result.outlierRows.length,
        totalAnalyzed: values.length,
        significance: result.outlierRows.length > 0,
      };
      break;
    }
    case "sample": {
      const method = (config.method as "random" | "mus") ?? "random";
      const sampleSize = config.sampleSize ?? 30;
      const amountField = config.amountField ?? "amount";
      const result =
        method === "mus"
          ? monetaryUnitSample(data, amountField, sampleSize)
          : randomSample(data.length, sampleSize);
      resultJson = { ...result, method } as unknown as Record<string, unknown>;
      summaryJson = {
        flaggedCount: 0,
        totalAnalyzed: data.length,
        significance: false,
      };
      break;
    }
    default: {
      resultJson = {};
      break;
    }
  }

  const saved = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(auditAnalyticsResult)
      .values({
        orgId: ctx.orgId,
        importId: id,
        analysisType,
        configJson: config,
        resultJson,
        summaryJson,
        createdBy: ctx.userId,
      })
      .returning();
    return row;
  });

  return Response.json({ data: saved }, { status: 201 });
}

// ──────────────────────────────────────────────────────────────
// Analysis Functions
// ──────────────────────────────────────────────────────────────

function benfordAnalysis(values: number[]) {
  const observed = new Array(9).fill(0);
  for (const val of values) {
    const firstDigit = parseInt(Math.abs(val).toString()[0]);
    if (firstDigit >= 1) observed[firstDigit - 1]++;
  }
  const total = values.length;
  const expected = Array.from(
    { length: 9 },
    (_, i) => Math.log10(1 + 1 / (i + 1)) * total,
  );

  // Chi-squared test with 8 degrees of freedom
  const chiSquared = observed.reduce(
    (sum: number, obs: number, i: number) =>
      sum + Math.pow(obs - expected[i], 2) / expected[i],
    0,
  );

  // Approximate p-value using chi-squared CDF (simplified)
  const pValue = chiSquaredPValue(chiSquared, 8);

  const digitResults = observed.map((o: number, i: number) => ({
    digit: i + 1,
    observed: o / total,
    expected: expected[i] / total,
  }));

  const flaggedDigits = digitResults
    .filter((d) => Math.abs(d.observed - d.expected) > 0.05)
    .map((d) => ({
      digit: d.digit,
      deviation: Math.abs(d.observed - d.expected),
    }));

  return {
    observed: digitResults,
    chiSquared,
    pValue,
    significant: pValue < 0.05,
    flaggedDigits,
  };
}

function chiSquaredPValue(x: number, df: number): number {
  // Simplified Wilson-Hilferty approximation
  if (x <= 0) return 1;
  const z = Math.pow(x / df, 1 / 3) - (1 - 2 / (9 * df));
  const denom = Math.sqrt(2 / (9 * df));
  const normal = z / denom;
  // Standard normal CDF approximation
  return 1 - normalCDF(normal);
}

function normalCDF(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327;
  const p =
    d *
    Math.exp((-x * x) / 2) *
    (t *
      (0.31938153 +
        t *
          (-0.356563782 +
            t * (1.781477937 + t * (-1.821255978 + t * 1.330274429)))));
  return x >= 0 ? 1 - p : p;
}

function detectDuplicates(
  rows: Record<string, unknown>[],
  matchFields: string[],
  threshold: number,
): Array<{
  rowA: number;
  rowB: number;
  similarity: number;
  matchedFields: string[];
}> {
  const pairs: Array<{
    rowA: number;
    rowB: number;
    similarity: number;
    matchedFields: string[];
  }> = [];

  // Cap at 5000 rows for O(n^2) comparison
  const maxRows = Math.min(rows.length, 5000);

  for (let i = 0; i < maxRows; i++) {
    for (let j = i + 1; j < maxRows; j++) {
      let matchCount = 0;
      for (const field of matchFields) {
        const a = String(rows[i][field] ?? "").toLowerCase();
        const b = String(rows[j][field] ?? "").toLowerCase();
        if (a && b && levenshteinSimilarity(a, b) >= threshold) {
          matchCount++;
        }
      }
      const similarity =
        matchFields.length > 0 ? matchCount / matchFields.length : 0;
      if (similarity >= threshold) {
        pairs.push({
          rowA: i,
          rowB: j,
          similarity,
          matchedFields: matchFields,
        });
      }
    }
  }

  return pairs.sort((a, b) => b.similarity - a.similarity).slice(0, 100);
}

function levenshteinSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const dist = levenshteinDistance(a, b);
  return 1 - dist / maxLen;
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= a.length; i++) matrix[i] = [i];
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[a.length][b.length];
}

function detectOutliers(
  values: number[],
  method: "zscore" | "iqr",
  threshold: number,
): {
  outlierRows: number[];
  method: string;
  threshold: number;
  mean: number;
  stdDev: number;
} {
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const stdDev = Math.sqrt(
    values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length,
  );

  const outlierRows: number[] = [];

  if (method === "zscore") {
    for (let i = 0; i < values.length; i++) {
      const zScore = Math.abs((values[i] - mean) / stdDev);
      if (zScore > threshold) outlierRows.push(i);
    }
  } else {
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    const lower = q1 - 1.5 * iqr;
    const upper = q3 + 1.5 * iqr;
    for (let i = 0; i < values.length; i++) {
      if (values[i] < lower || values[i] > upper) outlierRows.push(i);
    }
  }

  return { outlierRows, method, threshold, mean, stdDev };
}

function monetaryUnitSample(
  rows: Record<string, unknown>[],
  amountField: string,
  sampleSize: number,
): {
  selectedRows: number[];
  interval: number;
  totalAmount: number;
  sampleSize: number;
} {
  const totalAmount = rows.reduce((s, r) => s + Number(r[amountField] ?? 0), 0);
  const interval = totalAmount / sampleSize;
  const startPoint = Math.random() * interval;

  const selected: number[] = [];
  let cumulative = 0;
  for (let i = 0; i < rows.length; i++) {
    cumulative += Number(rows[i][amountField] ?? 0);
    while (
      selected.length < sampleSize &&
      startPoint + selected.length * interval <= cumulative
    ) {
      selected.push(i);
    }
  }

  return { selectedRows: selected, interval, totalAmount, sampleSize };
}

function randomSample(
  totalRows: number,
  sampleSize: number,
): { selectedRows: number[]; sampleSize: number } {
  const indices = Array.from({ length: totalRows }, (_, i) => i);
  // Fisher-Yates shuffle
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return {
    selectedRows: indices.slice(0, Math.min(sampleSize, totalRows)),
    sampleSize: Math.min(sampleSize, totalRows),
  };
}
