import { db, risk, riskEvaluationLog } from "@grc/db";
import { phaseTransitionSchema, validatePhaseTransition } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// PATCH /api/v1/risks/:id/evaluation-phase — Transition evaluation phase
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "control_owner",
    "process_owner",
  );
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: riskId } = await params;
  const body = phaseTransitionSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Fetch current risk with extended fields via raw SQL
  const result = await db.execute(
    sql`SELECT id, owner_id, risk_category, inherent_likelihood, inherent_impact,
               residual_likelihood, residual_impact,
               COALESCE(evaluation_phase, 'assignment') as evaluation_phase
        FROM risk
        WHERE id = ${riskId} AND org_id = ${ctx.orgId} AND deleted_at IS NULL
        LIMIT 1`,
  );

  const currentRisk = result[0];
  if (!currentRisk) {
    return Response.json({ error: "Risk not found" }, { status: 404 });
  }

  const currentPhase = String(currentRisk.evaluation_phase ?? "assignment");
  const userRole = ctx.session.user.roles?.[0]?.role ?? "viewer";

  // Validate transition
  const riskData: Record<string, unknown> = {
    owner_id: currentRisk.owner_id,
    risk_category: currentRisk.risk_category,
    inherent_likelihood: currentRisk.inherent_likelihood,
    inherent_impact: currentRisk.inherent_impact,
    residual_likelihood: currentRisk.residual_likelihood,
    residual_impact: currentRisk.residual_impact,
  };

  const validation = validatePhaseTransition(
    currentPhase,
    body.data.newPhase,
    riskData,
    userRole,
  );

  if (!validation.valid) {
    return Response.json(
      {
        error: "Phase transition not allowed",
        missingFields: validation.missingFields,
      },
      { status: 422 },
    );
  }

  // Execute transition
  const updated = await withAuditContext(ctx, async (tx) => {
    // Update risk phase via raw SQL (column added by migration 843)
    await tx.execute(
      sql`UPDATE risk SET evaluation_phase = ${body.data.newPhase}::evaluation_phase,
                          updated_at = NOW(), updated_by = ${ctx.userId}
          WHERE id = ${riskId} AND org_id = ${ctx.orgId}`,
    );

    // Log the transition
    await tx.insert(riskEvaluationLog).values({
      riskId,
      orgId: ctx.orgId,
      oldPhase: currentPhase,
      newPhase: body.data.newPhase,
      transitionedBy: ctx.userId,
      justification: body.data.justification ?? null,
    });

    return { id: riskId, evaluationPhase: body.data.newPhase };
  });

  return Response.json({ data: updated });
}
