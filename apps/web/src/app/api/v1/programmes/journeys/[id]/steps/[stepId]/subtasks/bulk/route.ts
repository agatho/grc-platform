// PATCH /api/v1/programmes/journeys/[id]/steps/[stepId]/subtasks/bulk
//
// Bulk-Update mehrerer Subtasks eines Steps in einem Aufruf. Effizient für
// "alle 30 ISMS-Awareness-Subtasks dem neuen Verantwortlichen zuweisen"
// oder "alle Aufgaben um 14 Tage verschieben".
//
// Begrenzt auf 100 Items pro Call (Konvention im Repo).

import {
  db,
  programmeJourneySubtask,
  programmeJourneyEvent,
  PROGRAMME_SUBTASK_STATUS_VALUES,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { withAuth, withAuditContext } from "@/lib/api";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";

const bulkUpdateSchema = z
  .object({
    subtaskIds: z
      .array(z.string().uuid())
      .min(1)
      .max(100),
    update: z
      .object({
        status: z.enum(PROGRAMME_SUBTASK_STATUS_VALUES).optional(),
        ownerId: z.string().uuid().nullable().optional(),
        dueDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullable()
          .optional(),
        /** Verschiebt dueDate um delta Tage (kombinierbar mit absolutem dueDate -> absoluter gewinnt) */
        dueDateShiftDays: z.number().int().min(-365).max(365).optional(),
      })
      .refine(
        (d) =>
          Object.keys(d).filter((k) => d[k as keyof typeof d] !== undefined)
            .length > 0,
        { message: "At least one update field required" },
      ),
  });

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; stepId: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "control_owner");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("programme", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: journeyId, stepId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bulkUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  // Lade alle existing subtasks zur Validierung (Org+Step-Match)
  const existing = await db
    .select()
    .from(programmeJourneySubtask)
    .where(
      and(
        inArray(programmeJourneySubtask.id, parsed.data.subtaskIds),
        eq(programmeJourneySubtask.journeyStepId, stepId),
        eq(programmeJourneySubtask.orgId, ctx.orgId),
      ),
    );

  const validIds = new Set(existing.map((e) => e.id));
  const missingIds = parsed.data.subtaskIds.filter((id) => !validIds.has(id));

  // Pro Subtask Update zusammenstellen (dueDateShiftDays braucht per-row-Logik)
  const upd = parsed.data.update;
  const updated: Array<{ id: string }> = [];

  await withAuditContext(ctx, async () => {
    for (const sub of existing) {
      const update: Record<string, unknown> = {};
      if (upd.status !== undefined) {
        update.status = upd.status;
        if (upd.status === "in_progress" && !sub.startedAt) {
          update.startedAt = new Date();
        }
        if (upd.status === "completed") {
          update.completedAt = new Date();
          if (!sub.startedAt) update.startedAt = new Date();
        }
        if (upd.status !== "completed") {
          update.completedAt = null;
        }
      }
      if (upd.ownerId !== undefined) update.ownerId = upd.ownerId;

      let newDue: string | null | undefined = undefined;
      if (upd.dueDate !== undefined) {
        newDue = upd.dueDate;
      } else if (upd.dueDateShiftDays !== undefined && sub.dueDate) {
        const d = new Date(sub.dueDate + "T00:00:00Z");
        d.setUTCDate(d.getUTCDate() + upd.dueDateShiftDays);
        newDue = d.toISOString().slice(0, 10);
      }
      if (newDue !== undefined) update.dueDate = newDue;

      update.updatedAt = new Date();
      update.updatedBy = ctx.userId;

      await db
        .update(programmeJourneySubtask)
        .set(update)
        .where(eq(programmeJourneySubtask.id, sub.id));
      updated.push({ id: sub.id });
    }
  });

  // Single audit-event (nicht ein Event pro Subtask, sonst fluten wir den Log)
  await db.insert(programmeJourneyEvent).values({
    orgId: ctx.orgId,
    journeyId,
    stepId,
    eventType: "subtask.bulk_updated",
    actorId: ctx.userId,
    payload: {
      count: updated.length,
      fields: Object.keys(parsed.data.update).filter(
        (k) =>
          parsed.data.update[k as keyof typeof parsed.data.update] !==
          undefined,
      ),
    },
  });

  return Response.json({
    data: {
      requested: parsed.data.subtaskIds.length,
      updated: updated.length,
      missing: missingIds.length,
      missingIds,
    },
  });
}
