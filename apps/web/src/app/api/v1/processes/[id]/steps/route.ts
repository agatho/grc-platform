import { db, process, processStep } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, asc } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
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

  // Call-Activity Drill-Down (0363): join the linked child process so the
  // properties panel can render name + status. A soft-deleted target keeps
  // its id but yields NULL name/status → the UI flags the link as orphaned.
  const calledProcess = alias(process, "calledProcess");

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
      calledProcessId: processStep.calledProcessId,
      calledProcessName: calledProcess.name,
      calledProcessStatus: calledProcess.status,
      createdAt: processStep.createdAt,
      updatedAt: processStep.updatedAt,
    })
    .from(processStep)
    .leftJoin(
      calledProcess,
      and(
        eq(processStep.calledProcessId, calledProcess.id),
        isNull(calledProcess.deletedAt),
      ),
    )
    .where(and(eq(processStep.processId, id), isNull(processStep.deletedAt)))
    .orderBy(asc(processStep.sequenceOrder));

  return Response.json({ data: steps });
}
