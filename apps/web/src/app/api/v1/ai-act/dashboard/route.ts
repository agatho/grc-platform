import {
  db,
  aiSystem,
  aiConformityAssessment,
  aiHumanOversightLog,
  aiTransparencyEntry,
  aiFria,
} from "@grc/db";
import { eq, and, sql, isNull, gte } from "drizzle-orm";
import { withAuth } from "@/lib/api";

export async function GET(req: Request) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "dpo",
    "auditor",
    "viewer",
  );
  if (ctx instanceof Response) return ctx;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [
    totalSystems,
    highRisk,
    unacceptable,
    pendingAssessments,
    oversightCount,
    transparencyCount,
    friasPending,
    docsDue,
  ] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(aiSystem)
      .where(and(eq(aiSystem.orgId, ctx.orgId), isNull(aiSystem.deletedAt))),
    db
      .select({ count: sql<number>`count(*)` })
      .from(aiSystem)
      .where(
        and(
          eq(aiSystem.orgId, ctx.orgId),
          eq(aiSystem.riskClassification, "high"),
          isNull(aiSystem.deletedAt),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)` })
      .from(aiSystem)
      .where(
        and(
          eq(aiSystem.orgId, ctx.orgId),
          eq(aiSystem.riskClassification, "unacceptable"),
          isNull(aiSystem.deletedAt),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)` })
      .from(aiConformityAssessment)
      .where(
        and(
          eq(aiConformityAssessment.orgId, ctx.orgId),
          eq(aiConformityAssessment.status, "draft"),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)` })
      .from(aiHumanOversightLog)
      .where(
        and(
          eq(aiHumanOversightLog.orgId, ctx.orgId),
          gte(aiHumanOversightLog.reviewedAt, thirtyDaysAgo),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)` })
      .from(aiTransparencyEntry)
      .where(eq(aiTransparencyEntry.orgId, ctx.orgId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(aiFria)
      .where(and(eq(aiFria.orgId, ctx.orgId), eq(aiFria.status, "draft"))),
    // Art. 18-19: Documentation lifecycle — systems with review overdue (>12 months) or expiry within 90 days
    db.execute(
      sql`SELECT count(*)::int AS count FROM v_ai_documentation_status WHERE org_id = ${ctx.orgId} AND (review_overdue = true OR expiry_approaching = true)`,
    ),
  ]);

  return Response.json({
    data: {
      totalSystems: Number(totalSystems[0]?.count ?? 0),
      highRiskSystems: Number(highRisk[0]?.count ?? 0),
      unacceptableSystems: Number(unacceptable[0]?.count ?? 0),
      pendingAssessments: Number(pendingAssessments[0]?.count ?? 0),
      oversightLogs30d: Number(oversightCount[0]?.count ?? 0),
      transparencyEntries: Number(transparencyCount[0]?.count ?? 0),
      friasPending: Number(friasPending[0]?.count ?? 0),
      documentationDue: Number(
        (docsDue as unknown as Array<{ count?: unknown }>)[0]?.count ?? 0,
      ),
      frameworkCompliance: {},
      systemsByRisk: {},
      recentOversightLogs: [],
    },
  });
}
