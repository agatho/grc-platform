import { db, process, processVersion } from "@grc/db";
import { requireModule } from "@grc/auth";
import { validateBpmnAdvanced } from "@grc/shared";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/processes/:id/validate — Validate current version BPMN XML
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
  const [proc] = await db
    .select({ id: process.id })
    .from(process)
    .where(
      and(
        eq(process.id, id),
        eq(process.orgId, ctx.orgId),
        isNull(process.deletedAt),
      ),
    );

  if (!proc) {
    return Response.json({ error: "Process not found" }, { status: 404 });
  }

  // Get current version BPMN XML
  const [currentVersion] = await db
    .select({
      id: processVersion.id,
      versionNumber: processVersion.versionNumber,
      bpmnXml: processVersion.bpmnXml,
    })
    .from(processVersion)
    .where(
      and(
        eq(processVersion.processId, id),
        eq(processVersion.isCurrent, true),
      ),
    );

  if (!currentVersion || !currentVersion.bpmnXml) {
    return Response.json(
      { error: "No current version with BPMN XML found" },
      { status: 404 },
    );
  }

  // Run advanced validation
  const result = validateBpmnAdvanced(currentVersion.bpmnXml);

  return Response.json({
    data: {
      versionNumber: currentVersion.versionNumber,
      ...result,
    },
  });
}
