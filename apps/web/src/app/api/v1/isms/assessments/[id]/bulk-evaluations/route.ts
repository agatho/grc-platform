// PATCH /api/v1/isms/assessments/[id]/bulk-evaluations
//
// Sprint 1.4: Bulk-Update mehrerer assessment_control_eval auf einmal.
// Fuer UI-Flows wie "Apply Template" (z. B. alle Phys-Controls als
// 'effective' markieren nach Checkliste).
//
// Body: { updates: [{ evalId, result?, currentMaturity?, targetMaturity?, notes?, evidence? }] }

import { db, assessmentRun, assessmentControlEval } from "@grc/db";
import { requireModule } from "@grc/auth";
import { and, eq, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string }> };

const updateItem = z.object({
  evalId: z.string().uuid(),
  result: z
    .enum([
      "effective",
      "partially_effective",
      "ineffective",
      "not_applicable",
      "not_evaluated",
    ])
    .optional(),
  currentMaturity: z.number().int().min(0).max(5).optional(),
  targetMaturity: z.number().int().min(0).max(5).optional(),
  notes: z.string().max(5000).optional(),
  evidence: z.string().max(5000).optional(),
});

const bodySchema = z.object({
  updates: z.array(updateItem).min(1).max(500),
});

export async function PATCH(req: Request, { params }: RouteParams) {
  const { id: runId } = await params;

  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  // Run validieren
  const [run] = await db
    .select({ id: assessmentRun.id, orgId: assessmentRun.orgId })
    .from(assessmentRun)
    .where(
      and(eq(assessmentRun.id, runId), eq(assessmentRun.orgId, ctx.orgId)),
    );
  if (!run) {
    return Response.json(
      { error: "Assessment run not found" },
      { status: 404 },
    );
  }

  // Batch-Update
  let updated = 0;
  const failedEvals: Array<{ evalId: string; reason: string }> = [];

  await withAuditContext(ctx, async (tx) => {
    for (const item of parsed.data.updates) {
      const setValues: Record<string, unknown> = {
        updatedAt: new Date(),
      };
      if (item.result !== undefined) setValues.result = item.result;
      if (item.currentMaturity !== undefined)
        setValues.currentMaturity = item.currentMaturity;
      if (item.targetMaturity !== undefined)
        setValues.targetMaturity = item.targetMaturity;
      if (item.notes !== undefined) setValues.notes = item.notes;
      if (item.evidence !== undefined) setValues.evidence = item.evidence;

      // assessedAt nur setzen, wenn result != 'not_evaluated'
      if (item.result && item.result !== "not_evaluated") {
        setValues.assessedAt = new Date();
        setValues.assessedBy = ctx.userId;
      }

      const result = await tx
        .update(assessmentControlEval)
        .set(setValues)
        .where(
          and(
            eq(assessmentControlEval.id, item.evalId),
            eq(assessmentControlEval.assessmentRunId, runId),
            eq(assessmentControlEval.orgId, ctx.orgId),
          ),
        )
        .returning({ id: assessmentControlEval.id });

      if (result.length === 0) {
        failedEvals.push({
          evalId: item.evalId,
          reason: "Eval nicht gefunden oder nicht in diesem Run",
        });
      } else {
        updated++;
      }
    }

    // Run-Stats aktualisieren: completedEvaluations + completionPercentage
    const [{ completedCount, totalCount }] = await tx
      .select({
        completedCount: sql<number>`count(*) filter (where result != 'not_evaluated')::int`,
        totalCount: sql<number>`count(*)::int`,
      })
      .from(assessmentControlEval)
      .where(
        and(
          eq(assessmentControlEval.assessmentRunId, runId),
          eq(assessmentControlEval.orgId, ctx.orgId),
        ),
      );

    const pct =
      totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    await tx
      .update(assessmentRun)
      .set({
        completedEvaluations: completedCount,
        totalEvaluations: totalCount,
        completionPercentage: pct,
        updatedAt: new Date(),
      })
      .where(
        and(eq(assessmentRun.id, runId), eq(assessmentRun.orgId, ctx.orgId)),
      );
  });

  return Response.json({
    data: {
      updated,
      failed: failedEvals.length,
      failedEvals: failedEvals.slice(0, 20),
    },
  });
}
