import { db, riskPropagationResult } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/erm/propagation/heatmap — Aggregated risk per org-entity
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // Fetch the latest propagation results
  const results = await db
    .select()
    .from(riskPropagationResult)
    .where(eq(riskPropagationResult.orgId, ctx.orgId))
    .orderBy(desc(riskPropagationResult.computedAt))
    .limit(50);

  // Aggregate by target org
  const heatmap = new Map<
    string,
    { orgId: string; totalPropagatedScore: number; riskCount: number }
  >();

  for (const result of results) {
    const entries = (result.resultsJson ?? []) as Array<{
      orgId: string;
      propagatedScore: number;
    }>;

    for (const entry of entries) {
      const existing = heatmap.get(entry.orgId);
      if (existing) {
        existing.totalPropagatedScore += entry.propagatedScore;
        existing.riskCount++;
      } else {
        heatmap.set(entry.orgId, {
          orgId: entry.orgId,
          totalPropagatedScore: entry.propagatedScore,
          riskCount: 1,
        });
      }
    }
  }

  const data = Array.from(heatmap.values()).sort(
    (a, b) => b.totalPropagatedScore - a.totalPropagatedScore,
  );

  return Response.json({ data });
}
