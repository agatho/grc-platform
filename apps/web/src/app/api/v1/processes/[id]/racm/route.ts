// BPM Overhaul Phase 3: Risk and Control Matrix (RACM) per process.
//
// Returns one row per (activity × risk × control) combination, plus findings,
// suitable for the SOX-style RACM page and PDF/Excel export.

import { db, process, processStep, processStepRisk, processStepControl, risk, control, finding, controlTest } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, sql, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [existing] = await db
    .select({ id: process.id, name: process.name })
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

  // Steps with their linked risks
  const stepsWithRisks = await db
    .select({
      stepId: processStep.id,
      bpmnElementId: processStep.bpmnElementId,
      stepName: processStep.name,
      lineOfDefense: processStep.lineOfDefense,
      riskId: risk.id,
      riskTitle: risk.title,
      inherent: risk.riskScoreInherent,
      residual: risk.riskScoreResidual,
      riskStatus: risk.status,
    })
    .from(processStep)
    .leftJoin(processStepRisk, eq(processStep.id, processStepRisk.processStepId))
    .leftJoin(risk, and(eq(risk.id, processStepRisk.riskId), isNull(risk.deletedAt)))
    .where(and(eq(processStep.processId, id), isNull(processStep.deletedAt)))
    .orderBy(processStep.sequenceOrder, processStep.bpmnElementId);

  // Steps with their linked controls (and latest TOE result)
  const stepsWithControls = await db
    .select({
      stepId: processStep.id,
      controlId: control.id,
      controlTitle: control.title,
      controlStatus: control.status,
      controlType: control.controlType,
      automationLevel: control.automationLevel,
      latestToeResult: sql<string | null>`(
        SELECT ct.toe_result FROM control_test ct
        WHERE ct.control_id = ${control.id}
          AND ct.deleted_at IS NULL
        ORDER BY ct.test_date DESC NULLS LAST, ct.updated_at DESC
        LIMIT 1
      )`,
      latestTestDate: sql<string | null>`(
        SELECT ct.test_date FROM control_test ct
        WHERE ct.control_id = ${control.id}
          AND ct.deleted_at IS NULL
        ORDER BY ct.test_date DESC NULLS LAST
        LIMIT 1
      )`,
    })
    .from(processStep)
    .leftJoin(processStepControl, eq(processStep.id, processStepControl.processStepId))
    .leftJoin(control, and(eq(control.id, processStepControl.controlId), isNull(control.deletedAt)))
    .where(and(eq(processStep.processId, id), isNull(processStep.deletedAt)));

  // Findings tied to this process (or its steps)
  const findings = await db
    .select({
      id: finding.id,
      title: finding.title,
      severity: finding.severity,
      status: finding.status,
      processStepId: finding.processStepId,
      controlId: finding.controlId,
      remediationDueDate: finding.remediationDueDate,
    })
    .from(finding)
    .where(
      and(
        eq(finding.orgId, ctx.orgId),
        isNull(finding.deletedAt),
        sql`(${finding.processId} = ${id} OR ${finding.processStepId} IN (
          SELECT id FROM process_step WHERE process_id = ${id}
        ))`,
      ),
    );

  // Group into RACM rows per step
  const byStep = new Map<
    string,
    {
      stepId: string;
      bpmnElementId: string;
      stepName: string | null;
      lineOfDefense: string | null;
      risks: Set<string>;
      riskDetails: any[];
      controls: any[];
      findings: any[];
    }
  >();

  for (const r of stepsWithRisks) {
    const k = r.stepId;
    if (!byStep.has(k)) {
      byStep.set(k, {
        stepId: k,
        bpmnElementId: r.bpmnElementId,
        stepName: r.stepName,
        lineOfDefense: r.lineOfDefense,
        risks: new Set(),
        riskDetails: [],
        controls: [],
        findings: [],
      });
    }
    if (r.riskId) {
      const row = byStep.get(k)!;
      if (!row.risks.has(r.riskId)) {
        row.risks.add(r.riskId);
        row.riskDetails.push({
          id: r.riskId,
          title: r.riskTitle,
          inherent: r.inherent,
          residual: r.residual,
          status: r.riskStatus,
        });
      }
    }
  }

  for (const c of stepsWithControls) {
    if (!c.controlId) continue;
    const row = byStep.get(c.stepId);
    if (!row) continue;
    if (!row.controls.find((x) => x.id === c.controlId)) {
      row.controls.push({
        id: c.controlId,
        title: c.controlTitle,
        status: c.controlStatus,
        controlType: c.controlType,
        automationLevel: c.automationLevel,
        latestToeResult: c.latestToeResult,
        latestTestDate: c.latestTestDate,
      });
    }
  }

  for (const f of findings) {
    if (f.processStepId && byStep.has(f.processStepId)) {
      byStep.get(f.processStepId)!.findings.push(f);
    }
  }

  const rows = Array.from(byStep.values()).map((r) => ({
    stepId: r.stepId,
    bpmnElementId: r.bpmnElementId,
    stepName: r.stepName,
    lineOfDefense: r.lineOfDefense,
    risks: r.riskDetails,
    controls: r.controls,
    findings: r.findings,
  }));

  return Response.json({
    data: {
      processId: id,
      processName: existing.name,
      rows,
      counts: {
        totalActivities: rows.length,
        activitiesWithRisks: rows.filter((r) => r.risks.length > 0).length,
        activitiesWithControls: rows.filter((r) => r.controls.length > 0).length,
        activitiesWithFindings: rows.filter((r) => r.findings.length > 0).length,
        totalRisks: rows.reduce((a, r) => a + r.risks.length, 0),
        totalControls: rows.reduce((a, r) => a + r.controls.length, 0),
        totalFindings: rows.reduce((a, r) => a + r.findings.length, 0),
      },
    },
  });
}
