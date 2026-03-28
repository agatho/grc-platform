import { db, controlTestScript, controlTestExecution } from "@grc/db";
import { runTestExecutionSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/control-testing/scripts/:id/execute — Run test
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withAuth("admin", "control_owner", "auditor");
  if (ctx instanceof Response) return ctx;

  const { id: scriptId } = await params;

  // Verify script exists
  const [script] = await db.select().from(controlTestScript)
    .where(and(eq(controlTestScript.id, scriptId), eq(controlTestScript.orgId, ctx.orgId)));

  if (!script) return Response.json({ error: "Script not found" }, { status: 404 });

  const result = await withAuditContext(ctx, async (tx) => {
    const [execution] = await tx.insert(controlTestExecution)
      .values({
        scriptId,
        orgId: ctx.orgId,
        controlId: script.controlId,
        status: "pending",
        executedBy: ctx.userId,
        triggeredBy: "manual",
        startedAt: new Date(),
      })
      .returning();
    return execution;
  });

  return Response.json({ data: result }, { status: 201 });
}
