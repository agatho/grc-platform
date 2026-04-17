import {
  db,
  audit,
  auditChecklist,
  auditChecklistItem,
  finding,
  user,
  workItem,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { and, eq, isNull, asc, sql } from "drizzle-orm";
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

  return Response.json({
    data: {
      audit: auditRow,
      checklists,
      breakdown,
      findings,
      findingsBySeverity,
      nonconformingItems,
      generatedAt: new Date().toISOString(),
    },
  });
}
