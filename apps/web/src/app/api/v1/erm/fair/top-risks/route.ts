import { db, fairSimulationResult, risk, user } from "@grc/db";
import { requireModule } from "@grc/auth";
import { fairTopRisksQuerySchema } from "@grc/shared";
import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/erm/fair/top-risks — Top N risks by ALE (P50)
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "auditor", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // Parse query params
  const url = new URL(req.url);
  const parsed = fairTopRisksQuerySchema.safeParse({
    limit: url.searchParams.get("limit") ?? "10",
  });
  const limit = parsed.success ? parsed.data.limit : 10;

  // Get the latest completed simulation per risk using a lateral join approach
  // We use a subquery to get the most recent completed result per risk
  const topRisks = await db
    .select({
      riskId: risk.id,
      riskTitle: risk.title,
      riskCategory: risk.riskCategory,
      riskStatus: risk.status,
      ownerName: user.name,
      aleP5: fairSimulationResult.aleP5,
      aleP25: fairSimulationResult.aleP25,
      aleP50: fairSimulationResult.aleP50,
      aleP75: fairSimulationResult.aleP75,
      aleP95: fairSimulationResult.aleP95,
      aleMean: fairSimulationResult.aleMean,
      aleStdDev: fairSimulationResult.aleStdDev,
      computedAt: fairSimulationResult.computedAt,
      iterations: fairSimulationResult.iterations,
    })
    .from(risk)
    .innerJoin(
      fairSimulationResult,
      and(
        eq(fairSimulationResult.riskId, risk.id),
        eq(fairSimulationResult.orgId, ctx.orgId),
        eq(fairSimulationResult.status, "completed"),
      ),
    )
    .leftJoin(user, eq(user.id, risk.ownerId))
    .where(
      and(
        eq(risk.orgId, ctx.orgId),
        isNull(risk.deletedAt),
      ),
    )
    .orderBy(desc(sql`CAST(${fairSimulationResult.aleP50} AS numeric)`))
    .limit(limit);

  // Deduplicate — keep only the most recent simulation per risk
  const seenRisks = new Set<string>();
  const deduplicated = topRisks.filter((row) => {
    if (seenRisks.has(row.riskId)) return false;
    seenRisks.add(row.riskId);
    return true;
  });

  return Response.json({
    data: deduplicated.map((r) => ({
      riskId: r.riskId,
      riskTitle: r.riskTitle,
      riskCategory: r.riskCategory,
      status: r.riskStatus,
      ownerName: r.ownerName,
      aleP50: Number(r.aleP50),
      aleP95: Number(r.aleP95),
      aleMean: Number(r.aleMean),
      computedAt: r.computedAt,
      iterations: r.iterations,
    })),
  });
}
