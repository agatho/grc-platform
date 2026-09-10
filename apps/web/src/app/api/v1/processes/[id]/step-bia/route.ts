// GET /api/v1/processes/:id/step-bia — Kontinuitätskennzahlen je Schritt.
//
// [ARCTOS-FULL-2026-08-31 · OP-001] `process_step_bia` (0449) trägt MTPD, RTO
// und RPO auf **Elementebene**. `bia_process_impact` führt `mtpd_hours` je
// Prozess; §3.10 rechnet den Reisspunkt aber als Minimum über die Schritte —
// ohne Elementebene gäbe es nichts zu minimieren (STUFE2-E §1.5). Ohne diese
// Maske blieb die Tabelle leer und die Layer `bcm` und `outage` (F6) datenlos.
//
// Wie bei RACI liefert die Route die Schritte **mit** ihren Kennzahlen, damit
// die Maske auch die Schritte zeigen kann, an denen noch nichts hängt.

import {
  db,
  process,
  processStep,
  processStepBia,
  biaAssessment,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { and, asc, desc, eq, isNull, inArray } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth(
    "admin",
    "process_owner",
    "risk_manager",
    "bcm_manager",
    "compliance_officer",
    "auditor",
    "viewer",
  );
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [proc] = await db
    .select({ id: process.id, name: process.name })
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

  const steps = await db
    .select({
      id: processStep.id,
      bpmnElementId: processStep.bpmnElementId,
      name: processStep.name,
      stepType: processStep.stepType,
      sequenceOrder: processStep.sequenceOrder,
    })
    .from(processStep)
    .where(
      and(
        eq(processStep.processId, id),
        eq(processStep.orgId, ctx.orgId),
        isNull(processStep.deletedAt),
      ),
    )
    .orderBy(asc(processStep.sequenceOrder));

  const stepIds = steps.map((s) => s.id);
  const bia = stepIds.length
    ? await db
        .select({
          processStepId: processStepBia.processStepId,
          criticality: processStepBia.criticality,
          mtpdMinutes: processStepBia.mtpdMinutes,
          rtoMinutes: processStepBia.rtoMinutes,
          rpoMinutes: processStepBia.rpoMinutes,
          workaround: processStepBia.workaround,
          workaroundMaxDurationMinutes:
            processStepBia.workaroundMaxDurationMinutes,
          biaAssessmentId: processStepBia.biaAssessmentId,
          updatedAt: processStepBia.updatedAt,
        })
        .from(processStepBia)
        .where(
          and(
            eq(processStepBia.orgId, ctx.orgId),
            inArray(processStepBia.processStepId, stepIds),
          ),
        )
    : [];
  const byStep = new Map(bia.map((b) => [b.processStepId, b]));

  const assessments = await db
    .select({ id: biaAssessment.id, name: biaAssessment.name })
    .from(biaAssessment)
    .where(eq(biaAssessment.orgId, ctx.orgId))
    .orderBy(desc(biaAssessment.createdAt))
    .limit(100);

  // Der Reisspunkt des Prozesses: das Minimum der MTPD über alle Schritte,
  // die einen führen (§3.10). Ausdrücklich `null`, wenn kein Schritt einen
  // Wert hat — eine 0 wäre hier eine Behauptung.
  const mtpds = bia
    .map((b) => b.mtpdMinutes)
    .filter((v): v is number => typeof v === "number");

  return Response.json({
    data: steps.map((s) => ({ ...s, bia: byStep.get(s.id) ?? null })),
    meta: {
      processId: proc.id,
      processName: proc.name,
      coveredSteps: bia.length,
      totalSteps: steps.length,
      processMtpdMinutes: mtpds.length ? Math.min(...mtpds) : null,
    },
    options: { assessments },
  });
});
