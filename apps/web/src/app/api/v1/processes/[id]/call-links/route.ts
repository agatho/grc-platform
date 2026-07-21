import { db, process, processStep } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, isNotNull, asc } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { withAuth } from "@/lib/api";

// Call-Activity Drill-Down: process hierarchy links in both directions.
//
// GET /api/v1/processes/:id/call-links
//   data.calls    — child processes this process invokes via
//                   call_activity / subprocess steps
//                   (calledProcessName === null ⇒ orphaned link: the
//                   target was soft-deleted after linking)
//   data.calledBy — processes that invoke this process
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

  const calledProcess = alias(process, "calledProcess");
  const callerProcess = alias(process, "callerProcess");

  const [calls, calledBy] = await Promise.all([
    // Outgoing: steps of this process that link a child process. A
    // soft-deleted target yields NULL name/status → orphaned link.
    db
      .select({
        stepId: processStep.id,
        bpmnElementId: processStep.bpmnElementId,
        stepName: processStep.name,
        stepType: processStep.stepType,
        calledProcessId: processStep.calledProcessId,
        calledProcessName: calledProcess.name,
        calledProcessStatus: calledProcess.status,
      })
      .from(processStep)
      .leftJoin(
        calledProcess,
        and(
          eq(processStep.calledProcessId, calledProcess.id),
          isNull(calledProcess.deletedAt),
        ),
      )
      .where(
        and(
          eq(processStep.processId, id),
          isNull(processStep.deletedAt),
          isNotNull(processStep.calledProcessId),
        ),
      )
      .orderBy(asc(processStep.sequenceOrder)),
    // Incoming: steps of other processes (same org) that call this one.
    db
      .select({
        stepId: processStep.id,
        bpmnElementId: processStep.bpmnElementId,
        stepName: processStep.name,
        processId: callerProcess.id,
        processName: callerProcess.name,
        processStatus: callerProcess.status,
      })
      .from(processStep)
      .innerJoin(
        callerProcess,
        and(
          eq(processStep.processId, callerProcess.id),
          eq(callerProcess.orgId, ctx.orgId),
          isNull(callerProcess.deletedAt),
        ),
      )
      .where(
        and(eq(processStep.calledProcessId, id), isNull(processStep.deletedAt)),
      )
      .orderBy(asc(callerProcess.name)),
  ]);

  return Response.json({ data: { calls, calledBy } });
}
