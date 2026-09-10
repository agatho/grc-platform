import { db, process, risk, processRisk } from "@grc/db";
import { linkProcessRiskSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// POST /api/v1/processes/:id/risks — Link risk to process
export const POST = withErrorHandler(async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "process_owner", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const body = linkProcessRiskSchema.safeParse(await req.json());
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
    .select({ id: processRisk.id })
    .from(processRisk)
    .where(
      and(
        eq(processRisk.processId, id),
        eq(processRisk.riskId, body.data.riskId),
      ),
    );

  if (duplicate) {
    return Response.json(
      { error: "Risk is already linked to this process" },
      { status: 409 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(processRisk)
      .values({
        orgId: ctx.orgId,
        processId: id,
        riskId: body.data.riskId,
        riskContext: body.data.riskContext,
        createdBy: ctx.userId,
      })
      .returning();
    return row;
  });

  return Response.json({ data: result }, { status: 201 });
});
// GET /api/v1/processes/:id/risks — List process-level risks
export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

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

  const risks = await db
    .select({
      linkId: processRisk.id,
      riskId: risk.id,
      title: risk.title,
      description: risk.description,
      riskCategory: risk.riskCategory,
      status: risk.status,
      riskScoreInherent: risk.riskScoreInherent,
      riskScoreResidual: risk.riskScoreResidual,
      riskContext: processRisk.riskContext,
      createdAt: processRisk.createdAt,
    })
    .from(processRisk)
    .innerJoin(risk, eq(processRisk.riskId, risk.id))
    .where(and(eq(processRisk.processId, id), isNull(risk.deletedAt)));

  return Response.json({ data: risks });
});
