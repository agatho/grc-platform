// POST /api/v1/dpms/dpia/[id]/transition
//
// Sprint 3.2: DPIA-Status-Transitions mit 3 Gates (Start/Complete/Approve).

import { db, dpia, dpiaRisk, dpiaMeasure } from "@grc/db";
import { requireModule } from "@grc/auth";
import {
  validateDpiaTransition,
  type DpiaSnapshot,
  type DpiaStatus,
} from "@grc/shared";
import { and, eq, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  targetStatus: z.enum([
    "draft",
    "in_progress",
    "completed",
    "pending_dpo_review",
    "approved",
    "rejected",
  ]),
  priorConsultationRequired: z.boolean().optional(),
  reason: z.string().max(2000).optional(),
});

export async function POST(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const ctx = await withAuth("admin", "dpo", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dpms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const [row] = await db
    .select()
    .from(dpia)
    .where(and(eq(dpia.id, id), eq(dpia.orgId, ctx.orgId)));
  if (!row) {
    return Response.json({ error: "DPIA not found" }, { status: 404 });
  }

  const [{ riskCount }] = await db
    .select({ riskCount: sql<number>`count(*)::int` })
    .from(dpiaRisk)
    .where(eq(dpiaRisk.dpiaId, id));

  const [{ measureCount }] = await db
    .select({ measureCount: sql<number>`count(*)::int` })
    .from(dpiaMeasure)
    .where(eq(dpiaMeasure.dpiaId, id));

  // Mitigated-Risk-Count: dpia_measure hat keinen direkten FK auf dpia_risk
  // im aktuellen Schema (nur dpiaId). Als Proxy verwenden wir min(riskCount,
  // measureCount). Spaeter via dedizierte dpia_risk_measure-Relation genauer.
  const mitigatedCount = Math.min(riskCount ?? 0, measureCount ?? 0);

  const snapshot: DpiaSnapshot = {
    status: row.status,
    title: row.title,
    processingDescription: row.processingDescription,
    necessityAssessment: row.necessityAssessment,
    systematicDescription: row.systematicDescription,
    dataCategories: row.dataCategories,
    dataSubjectCategories: row.dataSubjectCategories,
    riskCount: riskCount ?? 0,
    measureCount: measureCount ?? 0,
    mitigatedRiskCount: mitigatedCount ?? 0,
    dpoOpinion: row.dpoOpinion,
    consultationDate: row.consultationDate,
    residualRiskSignOffId: row.residualRiskSignOffId,
    priorConsultationRequired:
      parsed.data.priorConsultationRequired ?? row.dpoConsultationRequired,
  };

  const validation = validateDpiaTransition({
    currentStatus: row.status as DpiaStatus,
    targetStatus: parsed.data.targetStatus,
    snapshot,
  });

  if (!validation.allowed) {
    return Response.json(
      {
        blocked: true,
        currentStatus: row.status,
        targetStatus: parsed.data.targetStatus,
        blockers: validation.blockers,
      },
      { status: 422 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const updates: Record<string, unknown> = {
      status: parsed.data.targetStatus,
      updatedAt: new Date(),
    };
    const [updated] = await tx
      .update(dpia)
      .set(updates)
      .where(and(eq(dpia.id, id), eq(dpia.orgId, ctx.orgId)))
      .returning();
    return updated;
  });

  return Response.json({
    data: result,
    previousStatus: row.status,
    blockers: validation.blockers,
  });
}
