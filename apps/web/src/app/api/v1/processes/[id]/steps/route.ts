import { db, process, processStep } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, asc } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/processes/:id/steps — List process steps (sorted by sequenceOrder)
export async function GET(
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

  const steps = await db
    .select({
      id: processStep.id,
      processId: processStep.processId,
      bpmnElementId: processStep.bpmnElementId,
      name: processStep.name,
      description: processStep.description,
      stepType: processStep.stepType,
      responsibleRole: processStep.responsibleRole,
      sequenceOrder: processStep.sequenceOrder,
      createdAt: processStep.createdAt,
      updatedAt: processStep.updatedAt,
    })
    .from(processStep)
    .where(
      and(
        eq(processStep.processId, id),
        isNull(processStep.deletedAt),
      ),
    )
    .orderBy(asc(processStep.sequenceOrder));

  return Response.json({ data: steps });
}
