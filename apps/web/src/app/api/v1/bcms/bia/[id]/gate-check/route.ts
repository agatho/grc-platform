// GET /api/v1/bcms/bia/[id]/gate-check
//
// Sprint 2.1 Gate-B1+B2-Check.
// Liefert aktuelle Snapshot-Werte + Coverage-Stats + Blocker.

import {
  db,
  biaAssessment,
  biaProcessImpact,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import {
  validateBcmsGate1Setup,
  validateBcmsGate2Coverage,
  type BiaSnapshot,
  type BiaCoverageStats,
} from "@grc/shared";
import { and, eq, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params;
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, "GET");
  if (moduleCheck) return moduleCheck;

  const [bia] = await db
    .select()
    .from(biaAssessment)
    .where(and(eq(biaAssessment.id, id), eq(biaAssessment.orgId, ctx.orgId)));
  if (!bia) {
    return Response.json({ error: "BIA not found" }, { status: 404 });
  }

  // Process-Impact-Stats
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(biaProcessImpact)
    .where(eq(biaProcessImpact.biaAssessmentId, id));

  const [{ scored }] = await db
    .select({ scored: sql<number>`count(*)::int` })
    .from(biaProcessImpact)
    .where(
      and(
        eq(biaProcessImpact.biaAssessmentId, id),
        sql`${biaProcessImpact.mtpdHours} IS NOT NULL`,
        sql`${biaProcessImpact.rtoHours} IS NOT NULL`,
        sql`${biaProcessImpact.rpoHours} IS NOT NULL`,
      ),
    );

  const [{ essential }] = await db
    .select({ essential: sql<number>`count(*)::int` })
    .from(biaProcessImpact)
    .where(
      and(
        eq(biaProcessImpact.biaAssessmentId, id),
        eq(biaProcessImpact.isEssential, true),
      ),
    );

  const snapshot: BiaSnapshot = {
    status: bia.status,
    name: bia.name,
    description: bia.description,
    periodStart: bia.periodStart,
    periodEnd: bia.periodEnd,
    leadAssessorId: bia.leadAssessorId,
    totalProcessImpacts: total ?? 0,
    scoredImpacts: scored ?? 0,
    essentialCount: essential ?? 0,
  };

  const coverageStats: BiaCoverageStats = {
    totalProcessImpacts: total ?? 0,
    scoredImpacts: scored ?? 0,
    essentialCount: essential ?? 0,
    minimumEssentialCount: 3, // Empfehlung: min. 3 essential processes je BIA
  };

  const b1Blockers = validateBcmsGate1Setup(snapshot);
  const b2Blockers = validateBcmsGate2Coverage(coverageStats);

  return Response.json({
    data: {
      biaAssessmentId: bia.id,
      snapshot,
      coverageStats,
      b1: {
        passed: b1Blockers.filter((b) => b.severity === "error").length === 0,
        blockers: b1Blockers,
      },
      b2: {
        passed: b2Blockers.filter((b) => b.severity === "error").length === 0,
        blockers: b2Blockers,
      },
    },
  });
}
