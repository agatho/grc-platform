// PUT / DELETE /api/v1/processes/:id/step-bia/:stepId
//
// [ARCTOS-FULL-2026-08-31 · OP-001] Die Schreibseite zu `process_step_bia`.
//
// PUT ist ein Upsert über `process_step_bia_step_uniq` — der Vertrag führt
// die Kennzahlen als Einzelobjekt je Schritt, zwei widersprüchliche Zeilen zu
// einem Schritt wären kein Modellierungsfall, sondern ein Datenfehler.
//
// `workaroundMaxDurationMinutes: 0` wird ausdrücklich durchgereicht und NICHT
// auf NULL normalisiert: `simulateOutage` wertet 0 als „die Übergangslösung
// trägt nicht" (§7.4). Die 0 ist eine Aussage. Ein `|| null` an dieser Stelle
// wäre genau der Fehler, den STUFE2-E §1.5 benennt.

import {
  db,
  process,
  processStep,
  processStepBia,
  biaAssessment,
} from "@grc/db";
import { putStepBiaSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { and, eq, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";
import { biaValuesFrom } from "../../../_lib/grc-maintenance";

async function loadStep(orgId: string, processId: string, stepId: string) {
  const [proc] = await db
    .select({ id: process.id })
    .from(process)
    .where(
      and(
        eq(process.id, processId),
        eq(process.orgId, orgId),
        isNull(process.deletedAt),
      ),
    );
  if (!proc) return { error: "Process not found" as const };
  const [step] = await db
    .select({ id: processStep.id })
    .from(processStep)
    .where(
      and(
        eq(processStep.id, stepId),
        eq(processStep.processId, processId),
        eq(processStep.orgId, orgId),
        isNull(processStep.deletedAt),
      ),
    );
  if (!step) return { error: "Step not found" as const };
  return { step };
}

export const PUT = withErrorHandler(async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; stepId: string }> },
) {
  const ctx = await withAuth(
    "admin",
    "process_owner",
    "bcm_manager",
    "compliance_officer",
  );
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id, stepId } = await params;
  const parsed = putStepBiaSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const found = await loadStep(ctx.orgId, id, stepId);
  if ("error" in found) {
    return Response.json({ error: found.error }, { status: 404 });
  }

  const v = parsed.data;
  if (v.biaAssessmentId) {
    const [row] = await db
      .select({ id: biaAssessment.id })
      .from(biaAssessment)
      .where(
        and(
          eq(biaAssessment.id, v.biaAssessmentId),
          eq(biaAssessment.orgId, ctx.orgId),
        ),
      );
    if (!row) {
      return Response.json(
        { error: "Unknown BIA assessment" },
        { status: 422 },
      );
    }
  }

  // `biaValuesFrom` ist die Stelle, an der 0 durchkommt und `undefined` nicht
  // — siehe `_lib/grc-maintenance.ts`.
  const values = {
    orgId: ctx.orgId,
    processStepId: stepId,
    ...biaValuesFrom(v),
  };

  const saved = await withAuditContext(
    ctx,
    async (tx) => {
      const [row] = await tx
        .insert(processStepBia)
        .values({ ...values, createdBy: ctx.userId, updatedBy: ctx.userId })
        .onConflictDoUpdate({
          target: processStepBia.processStepId,
          set: {
            criticality: values.criticality,
            mtpdMinutes: values.mtpdMinutes,
            rtoMinutes: values.rtoMinutes,
            rpoMinutes: values.rpoMinutes,
            workaround: values.workaround,
            workaroundMaxDurationMinutes: values.workaroundMaxDurationMinutes,
            biaAssessmentId: values.biaAssessmentId,
            updatedAt: new Date(),
            updatedBy: ctx.userId,
          },
        })
        .returning();
      return row;
    },
    { actionDetail: `Step BIA saved (${stepId})` },
  );

  return Response.json({ data: saved });
});

export const DELETE = withErrorHandler(async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; stepId: string }> },
) {
  const ctx = await withAuth("admin", "process_owner", "bcm_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id, stepId } = await params;
  const found = await loadStep(ctx.orgId, id, stepId);
  if ("error" in found) {
    return Response.json({ error: found.error }, { status: 404 });
  }

  await withAuditContext(
    ctx,
    async (tx) => {
      await tx
        .delete(processStepBia)
        .where(
          and(
            eq(processStepBia.orgId, ctx.orgId),
            eq(processStepBia.processStepId, stepId),
          ),
        );
    },
    { actionDetail: `Step BIA removed (${stepId})` },
  );

  return Response.json({ data: { processStepId: stepId } });
});
