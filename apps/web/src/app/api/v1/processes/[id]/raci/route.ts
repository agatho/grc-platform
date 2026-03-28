import { db, process, processVersion, processRaciOverride } from "@grc/db";
import { deriveRACIFromBPMN, applyRACIOverrides } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/processes/:id/raci — Auto-derived RACI matrix
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "control_owner",
    "process_owner",
    "auditor",
    "viewer",
  );
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: processId } = await params;

  // Get latest published process version with BPMN XML
  const [proc] = await db
    .select({ id: process.id })
    .from(process)
    .where(
      and(
        eq(process.id, processId),
        eq(process.orgId, ctx.orgId),
        isNull(process.deletedAt),
      ),
    );

  if (!proc) {
    return Response.json({ error: "Process not found" }, { status: 404 });
  }

  const [latestVersion] = await db
    .select({
      id: processVersion.id,
      bpmnXml: processVersion.bpmnXml,
    })
    .from(processVersion)
    .where(eq(processVersion.processId, processId))
    .orderBy(desc(processVersion.versionNumber))
    .limit(1);

  if (!latestVersion?.bpmnXml) {
    return Response.json({
      data: { activities: [], participants: [], entries: [] },
    });
  }

  // Derive RACI from BPMN
  let matrix = deriveRACIFromBPMN(latestVersion.bpmnXml);

  // Apply manual overrides
  const overrides = await db
    .select({
      activityBpmnId: processRaciOverride.activityBpmnId,
      participantBpmnId: processRaciOverride.participantBpmnId,
      raciRole: processRaciOverride.raciRole,
    })
    .from(processRaciOverride)
    .where(
      and(
        eq(processRaciOverride.processVersionId, latestVersion.id),
        eq(processRaciOverride.orgId, ctx.orgId),
      ),
    );

  if (overrides.length > 0) {
    matrix = applyRACIOverrides(matrix, overrides);
  }

  return Response.json({ data: matrix });
}
