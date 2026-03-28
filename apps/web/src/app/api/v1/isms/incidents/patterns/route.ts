import { db, securityIncident } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, gte, isNull, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";

const MIN_OCCURRENCES = 3;

// GET /api/v1/isms/incidents/patterns — Detect recurring incident patterns
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const windowDays = Number(url.searchParams.get("windowDays") ?? "90");
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
      intervals.reduce((s, v) => s + Math.pow(v - avgInterval, 2), 0) / intervals.length,
    );

    // Low variance = high confidence pattern
    const coefficientOfVariation = stdDev / avgInterval;
    const confidence: "high" | "medium" | "low" =
      coefficientOfVariation < 0.3 ? "high" :
      coefficientOfVariation < 0.6 ? "medium" : "low";

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
}
