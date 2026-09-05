import { db, process, processStep, processStepRisk, risk } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { z } from "zod";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

const linkStepRiskSchema = z.object({
  riskId: z.string().uuid(),
});

// POST /api/v1/processes/:id/steps/:stepId/risks — Link risk to step
export const POST = withErrorHandler(async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; stepId: string }> },
) {
  const ctx = await withAuth("admin", "process_owner", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id, stepId } = await params;

  const body = linkStepRiskSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Verify process exists and belongs to org
  const [existing] = await db
    .select({ id: process.id })
    .from(process)
    .where(
      and(
        eq(process.id, id),
        eq(process.orgId, ctx.orgId),
        isNull(process.deletedAt),
      ),
    );

  if (!existing) {
    return Response.json({ error: "Process not found" }, { status: 404 });
  }

  // Verify step exists
  const [step] = await db
    .select({ id: processStep.id })
    .from(processStep)
    .where(
      and(
        eq(processStep.id, stepId),
        eq(processStep.processId, id),
        isNull(processStep.deletedAt),
      ),
    );

  if (!step) {
    return Response.json({ error: "Step not found" }, { status: 404 });
  }

  // Verify risk exists and belongs to same org
  const [riskRow] = await db
    .select({ id: risk.id })
    .from(risk)
    .where(
      and(
        eq(risk.id, body.data.riskId),
        eq(risk.orgId, ctx.orgId),
        isNull(risk.deletedAt),
      ),
    );

  if (!riskRow) {
    return Response.json(
      { error: "Risk not found in this organization" },
      { status: 422 },
    );
  }

  // Check duplicate
  const [duplicate] = await db
    .select({ id: processStepRisk.id })
    .from(processStepRisk)
    .where(
      and(
        eq(processStepRisk.processStepId, stepId),
        eq(processStepRisk.riskId, body.data.riskId),
      ),
    );

  if (duplicate) {
    return Response.json(
      { error: "Risk is already linked to this step" },
      { status: 409 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(processStepRisk)
      .values({
        orgId: ctx.orgId,
        processStepId: stepId,
        riskId: body.data.riskId,
        createdBy: ctx.userId,
      })
      .returning();
    return row;
  });

  return Response.json({ data: result }, { status: 201 });
});
// GET /api/v1/processes/:id/steps/:stepId/risks — List risks for specific step
export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; stepId: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id, stepId } = await params;

  // Verify process exists and belongs to org
  const [existing] = await db
    .select({ id: process.id })
    .from(process)
    .where(
      and(
        eq(process.id, id),
        eq(process.orgId, ctx.orgId),
        isNull(process.deletedAt),
      ),
    );

  if (!existing) {
    return Response.json({ error: "Process not found" }, { status: 404 });
  }

  // Verify step exists
  const [step] = await db
    .select({ id: processStep.id })
    .from(processStep)
    .where(
      and(
        eq(processStep.id, stepId),
        eq(processStep.processId, id),
        isNull(processStep.deletedAt),
      ),
    );

  if (!step) {
    return Response.json({ error: "Step not found" }, { status: 404 });
  }

  const risks = await db
    .select({
      linkId: processStepRisk.id,
      riskId: risk.id,
      title: risk.title,
      description: risk.description,
      riskCategory: risk.riskCategory,
      status: risk.status,
      riskScoreInherent: risk.riskScoreInherent,
      riskScoreResidual: risk.riskScoreResidual,
      createdAt: processStepRisk.createdAt,
    })
    .from(processStepRisk)
    .innerJoin(risk, eq(processStepRisk.riskId, risk.id))
    .where(
      and(eq(processStepRisk.processStepId, stepId), isNull(risk.deletedAt)),
    );

  return Response.json({ data: risks });
});
