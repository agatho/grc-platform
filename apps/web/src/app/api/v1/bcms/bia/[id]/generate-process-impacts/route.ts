// POST /api/v1/bcms/bia/[id]/generate-process-impacts
//
// Sprint 2.1: Bulk-Erzeugt bia_process_impact-Eintraege aus Process-Liste.
// Pro process in Scope-Filter (oder alle Org-Prozesse wenn kein Filter):
//   Wenn noch kein bia_process_impact existiert: anlegen mit NULL-Scoring
//
// Body (optional):
//   - processIds: uuid[] -- auf bestimmte Prozesse einschraenken
//   - includeSubProcesses: boolean -- falls Org Sub-Prozesse hat
//
// Dedup ueber UNIQUE(biaAssessmentId, processId).

import { db, biaAssessment, biaProcessImpact, process as processTable } from "@grc/db";
import { requireModule } from "@grc/auth";
import { and, eq, inArray, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  processIds: z.array(z.string().uuid()).optional(),
  includeSubProcesses: z.boolean().default(false),
});

const MAX_IMPACTS_PER_CALL = 2_000;

export async function POST(req: Request, { params }: RouteParams) {
  const { id: biaId } = await params;

  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  let bodyData: z.infer<typeof bodySchema>;
  try {
    const raw = await req.text();
    const parsed = bodySchema.safeParse(raw && raw.trim().length > 0 ? JSON.parse(raw) : {});
    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 422 },
      );
    }
    bodyData = parsed.data;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // BIA validieren
  const [bia] = await db
    .select()
    .from(biaAssessment)
    .where(and(eq(biaAssessment.id, biaId), eq(biaAssessment.orgId, ctx.orgId)));
  if (!bia) {
    return Response.json({ error: "BIA not found" }, { status: 404 });
  }
  if (bia.status !== "draft" && bia.status !== "in_progress") {
    return Response.json(
      { error: `BIA status '${bia.status}' -- Bulk-Generation nur fuer draft/in_progress` },
      { status: 422 },
    );
  }

  // Prozesse laden
  let processes: Array<{ id: string }> = await db
    .select({ id: processTable.id })
    .from(processTable)
    .where(eq(processTable.orgId, ctx.orgId));

  if (bodyData.processIds && bodyData.processIds.length > 0) {
    const filter = new Set(bodyData.processIds);
    processes = processes.filter((p) => filter.has(p.id));
  }

  if (processes.length === 0) {
    return Response.json(
      {
        error: "No processes matching filter",
        hint: "Stelle sicher, dass Prozesse im BPM-Modul angelegt sind.",
      },
      { status: 400 },
    );
  }

  if (processes.length > MAX_IMPACTS_PER_CALL) {
    return Response.json(
      {
        error: `Too many processes (${processes.length}). Max ${MAX_IMPACTS_PER_CALL}.`,
      },
      { status: 413 },
    );
  }

  // Bereits existierende Impacts laden
  const existing = await db
    .select({ processId: biaProcessImpact.processId })
    .from(biaProcessImpact)
    .where(eq(biaProcessImpact.biaAssessmentId, biaId));
  const existingSet = new Set(existing.map((e) => e.processId));

  const toInsert = processes.filter((p) => !existingSet.has(p.id));

  let created = 0;
  if (toInsert.length > 0) {
    await withAuditContext(ctx, async (tx) => {
      const CHUNK = 100;
      for (let i = 0; i < toInsert.length; i += CHUNK) {
        const chunk = toInsert.slice(i, i + CHUNK);
        await tx.insert(biaProcessImpact).values(
          chunk.map((p) => ({
            orgId: ctx.orgId,
            biaAssessmentId: biaId,
            processId: p.id,
          })),
        );
        created += chunk.length;
      }
    });
  }

  return Response.json({
    data: {
      biaAssessmentId: biaId,
      totalProcesses: processes.length,
      created,
      skipped: processes.length - toInsert.length,
    },
  });
}
