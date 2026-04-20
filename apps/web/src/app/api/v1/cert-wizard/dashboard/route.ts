import {
  db,
  certReadinessAssessment,
  certEvidencePackage,
  certMockAudit,
} from "@grc/db";
import { eq, and, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "auditor", "viewer");
  if (ctx instanceof Response) return ctx;

  const [totalAssess, avgReadiness, totalEvPkg, completedMock, avgMockScore] =
    await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(certReadinessAssessment)
        .where(eq(certReadinessAssessment.orgId, ctx.orgId)),
      db
        .select({ avg: sql<number>`COALESCE(avg(readiness_score), 0)` })
        .from(certReadinessAssessment)
        .where(eq(certReadinessAssessment.orgId, ctx.orgId)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(certEvidencePackage)
        .where(eq(certEvidencePackage.orgId, ctx.orgId)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(certMockAudit)
        .where(
          and(
            eq(certMockAudit.orgId, ctx.orgId),
            eq(certMockAudit.status, "completed"),
          ),
        ),
      db
        .select({ avg: sql<number>`COALESCE(avg(overall_score), 0)` })
        .from(certMockAudit)
        .where(
          and(
            eq(certMockAudit.orgId, ctx.orgId),
            eq(certMockAudit.status, "completed"),
          ),
        ),
    ]);

  return Response.json({
    data: {
      totalAssessments: Number(totalAssess[0]?.count ?? 0),
      averageReadiness: Number(avgReadiness[0]?.avg ?? 0),
      assessmentsByFramework: {},
      readinessByFramework: {},
      upcomingCertDates: [],
      totalEvidencePackages: Number(totalEvPkg[0]?.count ?? 0),
      completedMockAudits: Number(completedMock[0]?.count ?? 0),
      averageMockScore: Number(avgMockScore[0]?.avg ?? 0),
    },
  });
}
