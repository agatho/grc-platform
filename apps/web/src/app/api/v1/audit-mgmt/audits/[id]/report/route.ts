import {
  db,
  audit,
  auditChecklist,
  auditChecklistItem,
  finding,
  user,
  workItem,
  risk,
  riskTreatment,
  control,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { and, eq, isNull, asc, sql, inArray } from "drizzle-orm";
import { withAuth } from "@/lib/api";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/v1/audit-mgmt/audits/[id]/report
// Aggregated audit report data: metadata, checklist breakdown, findings list.
// Consumed by the ReportTab UI to render a full audit report without any
// further client-side joins.
export async function GET(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // 1. Audit metadata with lead auditor name
  const [auditRow] = await db
    .select({
      id: audit.id,
      title: audit.title,
      description: audit.description,
      auditType: audit.auditType,
      status: audit.status,
      scopeDescription: audit.scopeDescription,
      scopeProcesses: audit.scopeProcesses,
      scopeDepartments: audit.scopeDepartments,
      scopeFrameworks: audit.scopeFrameworks,
      leadAuditorId: audit.leadAuditorId,
      leadAuditorName: user.name,
      leadAuditorEmail: user.email,
      auditeeId: audit.auditeeId,
      plannedStart: audit.plannedStart,
      plannedEnd: audit.plannedEnd,
      actualStart: audit.actualStart,
      actualEnd: audit.actualEnd,
      findingCount: audit.findingCount,
      conclusion: audit.conclusion,
      createdAt: audit.createdAt,
      updatedAt: audit.updatedAt,
    })
    .from(audit)
    .leftJoin(user, eq(audit.leadAuditorId, user.id))
    .where(
      and(
        eq(audit.id, id),
        eq(audit.orgId, ctx.orgId),
        isNull(audit.deletedAt),
      ),
    );

  if (!auditRow) {
    return Response.json({ error: "Audit not found" }, { status: 404 });
  }

  // 2. Checklists for this audit
  const checklists = await db
    .select({
      id: auditChecklist.id,
      name: auditChecklist.name,
      sourceType: auditChecklist.sourceType,
      totalItems: auditChecklist.totalItems,
      completedItems: auditChecklist.completedItems,
      createdAt: auditChecklist.createdAt,
    })
    .from(auditChecklist)
    .where(
      and(
        eq(auditChecklist.auditId, id),
        eq(auditChecklist.orgId, ctx.orgId),
      ),
    );

  // 3. Per-checklist result breakdown
  type Breakdown = {
    checklistId: string;
    conforming: number;
    nonconforming: number;
    observation: number;
    not_applicable: number;
    unevaluated: number;
  };
  const breakdown: Breakdown[] = [];
  for (const cl of checklists) {
    const rows = await db
      .select({ result: auditChecklistItem.result, cnt: sql<number>`count(*)::int` })
      .from(auditChecklistItem)
      .where(eq(auditChecklistItem.checklistId, cl.id))
      .groupBy(auditChecklistItem.result);

    const entry: Breakdown = {
      checklistId: cl.id,
      conforming: 0,
      nonconforming: 0,
      observation: 0,
      not_applicable: 0,
      unevaluated: 0,
    };
    for (const r of rows) {
      if (r.result === null) entry.unevaluated = r.cnt;
      else if (r.result === "conforming") entry.conforming = r.cnt;
      else if (r.result === "nonconforming") entry.nonconforming = r.cnt;
      else if (r.result === "observation") entry.observation = r.cnt;
      else if (r.result === "not_applicable") entry.not_applicable = r.cnt;
    }
    breakdown.push(entry);
  }

  // 4. Findings for this audit (join work_item for human-readable elementId)
  const findings = await db
    .select({
      id: finding.id,
      title: finding.title,
      description: finding.description,
      severity: finding.severity,
      status: finding.status,
      elementId: workItem.elementId,
      remediationPlan: finding.remediationPlan,
      remediationDueDate: finding.remediationDueDate,
      ownerId: finding.ownerId,
      createdAt: finding.createdAt,
    })
    .from(finding)
    .leftJoin(workItem, eq(finding.workItemId, workItem.id))
    .where(
      and(
        eq(finding.auditId, id),
        eq(finding.orgId, ctx.orgId),
        isNull(finding.deletedAt),
      ),
    )
    .orderBy(asc(finding.createdAt));

  // 5. Findings grouped by severity (for summary chart)
  const findingsBySeverity: Record<string, number> = {};
  for (const f of findings) {
    const key = f.severity ?? "unknown";
    findingsBySeverity[key] = (findingsBySeverity[key] ?? 0) + 1;
  }

  // 6. Nonconforming checklist items — these were the basis for findings
  const nonconformingItems = await db
    .select({
      id: auditChecklistItem.id,
      question: auditChecklistItem.question,
      result: auditChecklistItem.result,
      notes: auditChecklistItem.notes,
      completedAt: auditChecklistItem.completedAt,
    })
    .from(auditChecklistItem)
    .leftJoin(
      auditChecklist,
      eq(auditChecklistItem.checklistId, auditChecklist.id),
    )
    .where(
      and(
        eq(auditChecklist.auditId, id),
        eq(auditChecklistItem.orgId, ctx.orgId),
        eq(auditChecklistItem.result, "nonconforming"),
      ),
    )
    .orderBy(asc(auditChecklistItem.sortOrder));

  // 7. Affected risks — closes the ISO 27001 9.2 / IIA 2120 feedback loop.
  //    Any risk that a finding of this audit links to is flagged so the
  //    report reader can verify whether the risk register still reflects
  //    reality after the audit's observations.
  const riskLinkedFindings = await db
    .select({
      findingId: finding.id,
      riskId: finding.riskId,
      severity: finding.severity,
      status: finding.status,
    })
    .from(finding)
    .where(
      and(
        eq(finding.auditId, id),
        eq(finding.orgId, ctx.orgId),
        isNull(finding.deletedAt),
      ),
    );

  const distinctRiskIds = Array.from(
    new Set(riskLinkedFindings.map((r) => r.riskId).filter((x): x is string => !!x)),
  );

  type AffectedRisk = {
    riskId: string;
    title: string | null;
    category: string | null;
    status: string | null;
    riskScoreResidual: number | null;
    linkedFindingCount: number;
    maxSeverity: string | null;
    openFindingCount: number;
    needsReassessment: boolean;
    hasTreatmentFromAudit: boolean;
  };
  const affectedRisks: AffectedRisk[] = [];

  if (distinctRiskIds.length > 0) {
    const risks = await db
      .select({
        id: risk.id,
        title: risk.title,
        category: risk.riskCategory,
        status: risk.status,
        riskScoreResidual: risk.riskScoreResidual,
      })
      .from(risk)
      .where(
        and(
          inArray(risk.id, distinctRiskIds),
          eq(risk.orgId, ctx.orgId),
          isNull(risk.deletedAt),
        ),
      );

    const severityRank: Record<string, number> = {
      observation: 1,
      recommendation: 2,
      improvement_requirement: 3,
      insignificant_nonconformity: 4,
      significant_nonconformity: 5,
    };
    const openStatuses = new Set(["identified", "in_remediation"]);
    const criticalSeverities = new Set([
      "improvement_requirement",
      "insignificant_nonconformity",
      "significant_nonconformity",
    ]);

    // Which risks have a treatment synced from one of our findings?
    // Match by riskTreatment.workItemId == finding.workItemId (the sync
    // endpoint in POST /findings/[id]/sync-treatment keys on this link).
    const findingWorkItems = await db
      .select({ workItemId: finding.workItemId })
      .from(finding)
      .where(
        and(
          eq(finding.auditId, id),
          eq(finding.orgId, ctx.orgId),
          isNull(finding.deletedAt),
        ),
      );
    const workItemIdsFromFindings = findingWorkItems
      .map((fw) => fw.workItemId)
      .filter((x): x is string => !!x);
    const treatedRiskIds = new Set<string>();
    if (workItemIdsFromFindings.length > 0) {
      const treatments = await db
        .select({
          riskId: riskTreatment.riskId,
          workItemId: riskTreatment.workItemId,
        })
        .from(riskTreatment)
        .where(
          and(
            eq(riskTreatment.orgId, ctx.orgId),
            isNull(riskTreatment.deletedAt),
            inArray(riskTreatment.workItemId, workItemIdsFromFindings),
          ),
        );
      for (const t of treatments) if (t.riskId) treatedRiskIds.add(t.riskId);
    }

    for (const rr of risks) {
      const linked = riskLinkedFindings.filter((f) => f.riskId === rr.id);
      let maxSeverity: string | null = null;
      let maxRank = 0;
      let openFindingCount = 0;
      let needsReassessment = false;
      for (const l of linked) {
        const rank = severityRank[l.severity] ?? 0;
        if (rank > maxRank) {
          maxRank = rank;
          maxSeverity = l.severity;
        }
        const open = openStatuses.has(l.status);
        if (open) openFindingCount++;
        if (open && criticalSeverities.has(l.severity)) needsReassessment = true;
      }
      affectedRisks.push({
        riskId: rr.id,
        title: rr.title,
        category: rr.category,
        status: rr.status,
        riskScoreResidual: rr.riskScoreResidual,
        linkedFindingCount: linked.length,
        maxSeverity,
        openFindingCount,
        needsReassessment,
        hasTreatmentFromAudit: treatedRiskIds.has(rr.id),
      });
    }

    // Sort by needsReassessment desc, then maxSeverity desc
    affectedRisks.sort((a, b) => {
      if (a.needsReassessment !== b.needsReassessment) {
        return a.needsReassessment ? -1 : 1;
      }
      const ra = severityRank[a.maxSeverity ?? ""] ?? 0;
      const rb = severityRank[b.maxSeverity ?? ""] ?? 0;
      return rb - ra;
    });
  }

  // 8. Affected controls — any control referenced by a finding of this audit.
  const controlFindings = await db
    .select({
      findingId: finding.id,
      controlId: finding.controlId,
      severity: finding.severity,
      status: finding.status,
    })
    .from(finding)
    .where(
      and(
        eq(finding.auditId, id),
        eq(finding.orgId, ctx.orgId),
        isNull(finding.deletedAt),
      ),
    );
  const distinctControlIds = Array.from(
    new Set(controlFindings.map((r) => r.controlId).filter((x): x is string => !!x)),
  );
  type AffectedControl = {
    controlId: string;
    title: string | null;
    controlType: string | null;
    openFindingCount: number;
    maxSeverity: string | null;
  };
  const affectedControls: AffectedControl[] = [];
  if (distinctControlIds.length > 0) {
    const ctrls = await db
      .select({
        id: control.id,
        title: control.title,
        controlType: control.controlType,
      })
      .from(control)
      .where(
        and(
          inArray(control.id, distinctControlIds),
          eq(control.orgId, ctx.orgId),
          isNull(control.deletedAt),
        ),
      );
    const openStatuses2 = new Set(["identified", "in_remediation"]);
    const severityRank2: Record<string, number> = {
      observation: 1,
      recommendation: 2,
      improvement_requirement: 3,
      insignificant_nonconformity: 4,
      significant_nonconformity: 5,
    };
    for (const cc of ctrls) {
      const linked = controlFindings.filter((f) => f.controlId === cc.id);
      let open = 0;
      let max: string | null = null;
      let rank = 0;
      for (const l of linked) {
        if (openStatuses2.has(l.status)) open++;
        const r = severityRank2[l.severity] ?? 0;
        if (r > rank) {
          rank = r;
          max = l.severity;
        }
      }
      affectedControls.push({
        controlId: cc.id,
        title: cc.title,
        controlType: cc.controlType,
        openFindingCount: open,
        maxSeverity: max,
      });
    }
  }

  return Response.json({
    data: {
      audit: auditRow,
      checklists,
      breakdown,
      findings,
      findingsBySeverity,
      nonconformingItems,
      affectedRisks,
      affectedControls,
      generatedAt: new Date().toISOString(),
    },
  });
}
