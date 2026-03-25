import {
  db,
  process,
  processVersion,
  processStep,
} from "@grc/db";
import { createVersionSchema } from "@grc/shared";
import { parseBpmnXml } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, desc } from "drizzle-orm";
import { withAuth, withAuditContext, paginate, paginatedResponse } from "@/lib/api";

// POST /api/v1/processes/:id/versions — Save BPMN as new version
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "process_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const body = createVersionSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Verify process exists and belongs to org
  const [existing] = await db
    .select({
      id: process.id,
      currentVersion: process.currentVersion,
      processOwnerId: process.processOwnerId,
    })
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

  // Parse BPMN XML to extract steps
  let parsedSteps;
  try {
    parsedSteps = parseBpmnXml(body.data.bpmnXml);
  } catch (e) {
    return Response.json(
      { error: `Invalid BPMN XML: ${(e as Error).message}` },
      { status: 422 },
    );
  }

  const newVersionNumber = existing.currentVersion + 1;

  const result = await withAuditContext(ctx, async (tx) => {
    // Mark all existing versions as not current
    await tx
      .update(processVersion)
      .set({ isCurrent: false })
      .where(eq(processVersion.processId, id));

    // Create new version
    const [version] = await tx
      .insert(processVersion)
      .values({
        processId: id,
        orgId: ctx.orgId,
        versionNumber: newVersionNumber,
        bpmnXml: body.data.bpmnXml,
        changeSummary: body.data.changeSummary,
        isCurrent: true,
        createdBy: ctx.userId,
      })
      .returning();

    // Update process currentVersion
    await tx
      .update(process)
      .set({
        currentVersion: newVersionNumber,
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .where(eq(process.id, id));

    // Sync ProcessStep records: upsert from parsed steps, soft-delete removed steps
    // Get existing active steps
    const existingSteps = await tx
      .select({
        id: processStep.id,
        bpmnElementId: processStep.bpmnElementId,
      })
      .from(processStep)
      .where(
        and(
          eq(processStep.processId, id),
          isNull(processStep.deletedAt),
        ),
      );

    const existingStepMap = new Map<string, string>(
      existingSteps.map((s: { bpmnElementId: string; id: string }) => [s.bpmnElementId, s.id]),
    );
    const parsedElementIds = new Set<string>(parsedSteps.map((s) => s.bpmnElementId));

    // Upsert parsed steps
    for (const step of parsedSteps) {
      const existingId = existingStepMap.get(step.bpmnElementId);
      if (existingId) {
        // Update existing step
        await tx
          .update(processStep)
          .set({
            name: step.name,
            stepType: step.stepType,
            sequenceOrder: step.sequenceOrder,
            updatedAt: new Date(),
          })
          .where(eq(processStep.id, existingId));
      } else {
        // Insert new step
        await tx.insert(processStep).values({
          processId: id,
          orgId: ctx.orgId,
          bpmnElementId: step.bpmnElementId,
          name: step.name,
          stepType: step.stepType,
          sequenceOrder: step.sequenceOrder,
        });
      }
    }

    // Soft-delete removed steps
    for (const [elementId, stepId] of existingStepMap) {
      if (!parsedElementIds.has(elementId)) {
        await tx
          .update(processStep)
          .set({ deletedAt: new Date() })
          .where(eq(processStep.id, stepId));
      }
    }

    return version;
  });

  return Response.json({ data: result }, { status: 201 });
}

// GET /api/v1/processes/:id/versions — List all versions
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

  const versions = await db
    .select({
      id: processVersion.id,
      processId: processVersion.processId,
      versionNumber: processVersion.versionNumber,
      changeSummary: processVersion.changeSummary,
      isCurrent: processVersion.isCurrent,
      createdBy: processVersion.createdBy,
      createdAt: processVersion.createdAt,
    })
    .from(processVersion)
    .where(eq(processVersion.processId, id))
    .orderBy(desc(processVersion.versionNumber));

  return Response.json({ data: versions });
}
