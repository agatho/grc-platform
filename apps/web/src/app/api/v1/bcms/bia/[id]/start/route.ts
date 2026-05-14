// POST /api/v1/bcms/bia/[id]/start
//
// #WAVE14D-P1-04: BIA discovery (`/transitions`) advertises a path for
// `draft → in_progress`, but the only matching endpoint was the generic
// PUT, which now explicitly rejects status changes (#WAVE6-BIA-01) with
// a hint pointing at /finalize. /finalize handles `in_progress → review`
// — there was no working path for the very first transition.
//
// Mirrors /finalize's shape: validates Gate B1 (Setup completeness via
// validateBcmsGate1Setup), returns 422 + blockers if anything's missing,
// otherwise transitions the BIA to `in_progress` via withAuditContext.

import { db, biaAssessment, biaProcessImpact } from "@grc/db";
import { requireModule } from "@grc/auth";
import { validateBcmsGate1Setup, type BiaSnapshot } from "@grc/shared";
import { and, eq, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";

type RouteParams = { params: Promise<{ id: string }> };

export const POST = withErrorHandler<RouteParams>(async function POST(
  _req: Request,
  { params },
) {
  const { id } = await params;
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, "POST");
  if (moduleCheck) return moduleCheck;

  const [bia] = await db
    .select({
      id: biaAssessment.id,
      status: biaAssessment.status,
      name: biaAssessment.name,
      description: biaAssessment.description,
      periodStart: biaAssessment.periodStart,
      periodEnd: biaAssessment.periodEnd,
      leadAssessorId: biaAssessment.leadAssessorId,
    })
    .from(biaAssessment)
    .where(and(eq(biaAssessment.id, id), eq(biaAssessment.orgId, ctx.orgId)));

  if (!bia) {
    return Response.json({ error: "BIA not found" }, { status: 404 });
  }

  if (bia.status !== "draft") {
    const msg = `BIA status '${bia.status}' — start nur von 'draft' möglich`;
    return Response.json(
      {
        error: msg,
        fieldErrors: { status: [msg] },
      },
      { status: 422 },
    );
  }

  // Coverage counters — Gate B1 doesn't gate on impacts (that's B2),
  // but the snapshot type wants them, so we count anyway. Cheap query.
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
    status: "draft",
    name: bia.name,
    description: bia.description,
    periodStart: bia.periodStart,
    periodEnd: bia.periodEnd,
    leadAssessorId: bia.leadAssessorId,
    totalProcessImpacts: total ?? 0,
    scoredImpacts: scored ?? 0,
    essentialCount: essential ?? 0,
  };

  const blockers = validateBcmsGate1Setup(snapshot);
  const hardBlockers = blockers.filter((b) => b.severity === "error");
  if (hardBlockers.length > 0) {
    return Response.json(
      {
        blocked: true,
        gate: "B1",
        blockers,
      },
      { status: 422 },
    );
  }

  const [updated] = await withAuditContext(ctx, async (tx) => {
    return tx
      .update(biaAssessment)
      .set({
        status: "in_progress",
        updatedAt: new Date(),
      })
      .where(and(eq(biaAssessment.id, id), eq(biaAssessment.orgId, ctx.orgId)))
      .returning();
  });

  return Response.json({
    data: {
      biaAssessmentId: updated.id,
      status: updated.status,
      previousStatus: "draft",
      blockers, // any warnings B1 surfaced (none today, kept for future)
      nextSteps: [
        {
          step: "score_process_impacts",
          label: "Process-Impacts mit MTPD/RTO/RPO scoren",
          endpoint: "/api/v1/bcms/bia/{id}/process-impacts",
        },
        {
          step: "finalize",
          label: "Wenn Gate B2 (Coverage) erreicht: in_progress → review",
          endpoint: `/api/v1/bcms/bia/${id}/finalize`,
        },
      ],
    },
  });
});
