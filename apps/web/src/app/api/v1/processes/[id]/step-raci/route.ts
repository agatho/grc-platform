// GET /api/v1/processes/:id/step-raci — die RACI-Zuordnungen aller Schritte.
//
// [ARCTOS-FULL-2026-08-31 · OP-001] `process_step_raci` (0447) ist die
// einzige Heimat von **C** und **I**: `process_raci_override` benennt die
// Beteiligten über rohe BPMN-Lane-IDs ohne Fremdschlüssel auf `custom_role`
// (STUFE2-E §1.3). Ohne Maske blieben `raci.consulted` und `raci.informed`
// dauerhaft leer — gemessen 0 Zeilen.
//
// Die Route liefert die Schritte **mit** ihren Zuordnungen, nicht nur die
// Zuordnungen: eine Maske, die nur die vorhandenen Zeilen zeigt, kann keine
// neue anlegen, weil sie den Schritt nicht kennt, an dem nichts hängt. Und
// genau die Schritte ohne Zuordnung sind die interessanten.

import { db, process, processStep, processStepRaci, customRole } from "@grc/db";
import { requireModule } from "@grc/auth";
import { and, asc, eq, isNull, inArray } from "drizzle-orm";
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
    "control_owner",
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
      responsibleRole: processStep.responsibleRole,
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
  const entries = stepIds.length
    ? await db
        .select({
          id: processStepRaci.id,
          processStepId: processStepRaci.processStepId,
          roleId: processStepRaci.roleId,
          roleName: customRole.name,
          raciRole: processStepRaci.raciRole,
          source: processStepRaci.source,
          note: processStepRaci.note,
        })
        .from(processStepRaci)
        .leftJoin(customRole, eq(processStepRaci.roleId, customRole.id))
        .where(
          and(
            eq(processStepRaci.orgId, ctx.orgId),
            inArray(processStepRaci.processStepId, stepIds),
          ),
        )
        .orderBy(asc(processStepRaci.raciRole), asc(customRole.name))
    : [];

  const byStep = new Map<string, typeof entries>();
  for (const e of entries) {
    const list = byStep.get(e.processStepId);
    if (list) list.push(e);
    else byStep.set(e.processStepId, [e]);
  }

  const roles = await db
    .select({ id: customRole.id, name: customRole.name })
    .from(customRole)
    .where(eq(customRole.orgId, ctx.orgId))
    .orderBy(asc(customRole.name));

  return Response.json({
    data: steps.map((s) => ({ ...s, raci: byStep.get(s.id) ?? [] })),
    meta: { processId: proc.id, processName: proc.name },
    options: { roles },
  });
});
