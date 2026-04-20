import { db, finding, riskTreatment } from "@grc/db";
import { requireModule } from "@grc/auth";
import { and, eq, isNull, inArray, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/risks/audit-impact-summary
//
// Batched audit-impact aggregate across all risks of the current org. Used
// by the risk list to render a "Neubewertung erforderlich" badge on each
// row without fanning out one audit-impact call per risk (N+1 avoidance).
//
// Response shape: a map keyed by riskId so the client can do a single
// dictionary lookup per table row.
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const openStatuses = ["identified", "in_remediation"] as const;
  const criticalSeverities = [
    "improvement_requirement",
    "insignificant_nonconformity",
    "significant_nonconformity",
  ] as const;

  // 1. Per-risk open-critical finding count
  const openCriticalRows = await db
    .select({
      riskId: finding.riskId,
      cnt: sql<number>`count(*)::int`,
    })
    .from(finding)
    .where(
      and(
        eq(finding.orgId, ctx.orgId),
        isNull(finding.deletedAt),
        sql`${finding.riskId} IS NOT NULL`,
        inArray(finding.status, [...openStatuses]),
        inArray(finding.severity, [...criticalSeverities]),
      ),
    )
    .groupBy(finding.riskId);

  // 2. Per-risk total open finding count (any severity)
  const openAnyRows = await db
    .select({
      riskId: finding.riskId,
      cnt: sql<number>`count(*)::int`,
    })
    .from(finding)
    .where(
      and(
        eq(finding.orgId, ctx.orgId),
        isNull(finding.deletedAt),
        sql`${finding.riskId} IS NOT NULL`,
        inArray(finding.status, [...openStatuses]),
      ),
    )
    .groupBy(finding.riskId);

  // 3. Per-risk audit-derived treatments (workItemId matches any finding wi)
  const treatmentRows = await db
    .select({
      riskId: riskTreatment.riskId,
      cnt: sql<number>`count(*)::int`,
    })
    .from(riskTreatment)
    .where(
      and(
        eq(riskTreatment.orgId, ctx.orgId),
        isNull(riskTreatment.deletedAt),
        sql`${riskTreatment.workItemId} IS NOT NULL`,
      ),
    )
    .groupBy(riskTreatment.riskId);

  const byRisk: Record<
    string,
    {
      openCritical: number;
      openAny: number;
      treatmentCount: number;
      needsReassessment: boolean;
    }
  > = {};

  for (const r of openCriticalRows) {
    if (!r.riskId) continue;
    byRisk[r.riskId] = byRisk[r.riskId] ?? {
      openCritical: 0,
      openAny: 0,
      treatmentCount: 0,
      needsReassessment: false,
    };
    byRisk[r.riskId].openCritical = r.cnt;
  }
  for (const r of openAnyRows) {
    if (!r.riskId) continue;
    byRisk[r.riskId] = byRisk[r.riskId] ?? {
      openCritical: 0,
      openAny: 0,
      treatmentCount: 0,
      needsReassessment: false,
    };
    byRisk[r.riskId].openAny = r.cnt;
  }
  for (const r of treatmentRows) {
    if (!r.riskId) continue;
    byRisk[r.riskId] = byRisk[r.riskId] ?? {
      openCritical: 0,
      openAny: 0,
      treatmentCount: 0,
      needsReassessment: false,
    };
    byRisk[r.riskId].treatmentCount = r.cnt;
  }
  for (const id of Object.keys(byRisk)) {
    byRisk[id].needsReassessment = byRisk[id].openCritical > 0;
  }

  return Response.json({ data: byRisk });
}
