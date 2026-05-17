// BPM Overhaul Phase 5: dedicated standalone import endpoint.
// Creates a new process from a BPMN XML payload + rehydrates arctos:* metadata.

import { db, process, processVersion, processStep } from "@grc/db";
import { parseBpmnXml } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { rehydrateFromBpmnXml } from "@/lib/bpmn-arctos-rehydrate";
import { z } from "zod";

const importSchema = z.object({
  name: z.string().min(3).max(500),
  description: z.string().max(5000).optional(),
  department: z.string().max(255).optional(),
  level: z.number().int().min(1).max(10).default(1),
  bpmnXml: z.string().min(50),
});

export async function POST(req: Request) {
  const ctx = await withAuth("admin", "process_owner");
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("bpm", ctx.orgId, req.method);
  if (m) return m;

  const parsed = importSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  // Sanity check: must contain bpmn:definitions
  if (!/<(bpmn:)?definitions\b/i.test(parsed.data.bpmnXml)) {
    return Response.json(
      { error: "Payload is not a valid BPMN 2.0 XML (no <bpmn:definitions>)" },
      { status: 422 },
    );
  }

  const parsedSteps = parseBpmnXml(parsed.data.bpmnXml);

  const result = await withAuditContext(
    ctx,
    async (tx) => {
      const [newProcess] = await tx
        .insert(process)
        .values({
          orgId: ctx.orgId,
          name: parsed.data.name,
          description: parsed.data.description ?? null,
          department: parsed.data.department ?? null,
          level: parsed.data.level,
          status: "draft",
          createdBy: ctx.userId,
        })
        .returning();

      const [version] = await tx
        .insert(processVersion)
        .values({
          processId: newProcess.id,
          orgId: ctx.orgId,
          versionNumber: 1,
          bpmnXml: parsed.data.bpmnXml,
          isCurrent: true,
          changeSummary: "Imported via /import-bpmn-xml",
          createdBy: ctx.userId,
        })
        .returning();

      const stepIdByBpmnElement = new Map<string, string>();
      for (const step of parsedSteps) {
        const [row] = await tx
          .insert(processStep)
          .values({
            processId: newProcess.id,
            orgId: ctx.orgId,
            bpmnElementId: step.bpmnElementId,
            name: step.name,
            stepType: step.stepType,
            sequenceOrder: step.sequenceOrder,
          })
          .returning({ id: processStep.id, bpmnElementId: processStep.bpmnElementId });
        stepIdByBpmnElement.set(row.bpmnElementId, row.id);
      }

      // Rehydrate arctos:* metadata
      let rehydrateStats = null;
      try {
        rehydrateStats = await rehydrateFromBpmnXml({
          tx,
          processId: newProcess.id,
          orgId: ctx.orgId,
          userId: ctx.userId,
          bpmnXml: parsed.data.bpmnXml,
          stepIdByBpmnElement,
        });
      } catch (e) {
        console.error("arctos rehydrate during import failed", e);
      }

      return { process: newProcess, version, stepCount: parsedSteps.length, rehydrateStats };
    },
    { actionDetail: `Imported process "${parsed.data.name}"` },
  );

  return Response.json({ data: result }, { status: 201 });
}
