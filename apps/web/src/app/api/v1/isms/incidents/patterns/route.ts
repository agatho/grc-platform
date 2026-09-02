import { db, securityIncident } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, gte, isNull, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { z } from "zod";
import { parseQueryParams, intQueryParam } from "@/lib/query-schema";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

const MIN_OCCURRENCES = 3;

// #S04-09 (ARCTOS-FULL-2026-08-31): query parameters are now validated
// against a schema instead of being read as `string | null` and cast
// with `as <enum>`. An unknown filter value used to reach Postgres and
// surface as a 500 (`invalid input value for enum …`); it is a 422 now,
// and free-text search terms are length-bounded.
const patternsQuerySchema = z.object({
  // Was `Number(... ?? "90")`: "abc" produced NaN, a NaN window start and a
  // Postgres error; a huge value scanned the whole table.
  windowDays: intQueryParam(1, 730, 90),
});

// GET /api/v1/isms/incidents/patterns — Detect recurring incident patterns
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const q = parseQueryParams(patternsQuerySchema, url.searchParams);
  if (!q.ok)
    return Response.json(
      { error: q.message, details: q.details },
      { status: 422 },
    );
  const windowDays = q.data.windowDays;
  const windowStart = new Date(Date.now() - windowDays * 86400000);

  const incidents = await db
    .select()
    .from(securityIncident)
    .where(
      and(
        eq(securityIncident.orgId, ctx.orgId),
        isNull(securityIncident.deletedAt),
        gte(securityIncident.detectedAt, windowStart),
      ),
    )
    .orderBy(securityIncident.detectedAt);

  // Group by category and detect patterns
  const categoryGroups = new Map<string, Date[]>();
  for (const inc of incidents) {
    const cat = inc.incidentType ?? "uncategorized";
    if (!categoryGroups.has(cat)) {
      categoryGroups.set(cat, []);
    }
    categoryGroups.get(cat)!.push(new Date(inc.detectedAt));
  }

  const patterns: Array<{
    description: string;
    confidence: "high" | "medium" | "low";
    occurrences: number;
    intervalDays: number | null;
    category: string;
  }> = [];

  for (const [category, dates] of categoryGroups) {
    if (dates.length < MIN_OCCURRENCES) continue;

    // Calculate intervals between occurrences
    const intervals: number[] = [];
    for (let i = 1; i < dates.length; i++) {
      intervals.push(
        (dates[i].getTime() - dates[i - 1].getTime()) / (1000 * 86400),
      );
    }

    const avgInterval = intervals.reduce((s, v) => s + v, 0) / intervals.length;
    const stdDev = Math.sqrt(
      intervals.reduce((s, v) => s + Math.pow(v - avgInterval, 2), 0) /
        intervals.length,
    );

    // Low variance = high confidence pattern
    const coefficientOfVariation = stdDev / avgInterval;
    const confidence: "high" | "medium" | "low" =
      coefficientOfVariation < 0.3
        ? "high"
        : coefficientOfVariation < 0.6
          ? "medium"
          : "low";

    patterns.push({
      description: `'${category}' incidents occur approximately every ${Math.round(avgInterval)} days`,
      confidence,
      occurrences: dates.length,
      intervalDays: Math.round(avgInterval),
      category,
    });
  }

  return Response.json({
    data: patterns.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.confidence] - order[b.confidence];
    }),
  });
});
