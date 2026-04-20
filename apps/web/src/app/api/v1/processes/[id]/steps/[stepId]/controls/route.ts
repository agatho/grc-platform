import { db, process, processStep, processStepControl } from "@grc/db";
import { linkProcessControlSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/processes/:id/steps/:stepId/controls — Link control to step
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; stepId: string }> },
) {
  const ctx = await withAuth("admin", "control_owner", "process_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id, stepId } = await params;

  const body = linkProcessControlSchema.safeParse(await req.json());
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

  // Check duplicate
  const [duplicate] = await db
    .select({ id: processStepControl.id })
    .from(processStepControl)
    .where(
      and(
        eq(processStepControl.processStepId, stepId),
        eq(processStepControl.controlId, body.data.controlId),
      ),
    );

  if (duplicate) {
    return Response.json(
      { error: "Control is already linked to this step" },
      { status: 409 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(processStepControl)
      .values({
        orgId: ctx.orgId,
        processStepId: stepId,
        controlId: body.data.controlId,
        controlContext: body.data.controlContext,
        createdBy: ctx.userId,
      })
      .returning();
    return row;
  });

  return Response.json({ data: result }, { status: 201 });
}

// GET /api/v1/processes/:id/steps/:stepId/controls — List controls for step
export async function GET(
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

  const controls = await db
    .select({
      linkId: processStepControl.id,
      controlId: processStepControl.controlId,
      controlContext: processStepControl.controlContext,
      createdAt: processStepControl.createdAt,
    })
    .from(processStepControl)
    .where(eq(processStepControl.processStepId, stepId));

  return Response.json({ data: controls });
}
