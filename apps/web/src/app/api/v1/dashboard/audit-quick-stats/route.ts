import {
  db,
  audit,
  auditChecklistItem,
  auditChecklist,
  finding,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, inArray, lt, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/dashboard/audit-quick-stats
//
// Aggregiert die Zahlen, die das Audit-Team üblicherweise am dringendsten
// braucht — „was ist heute fällig? was brennt?" Verwendet in der Audit-
// Modul-Navigation und ggf. auf dem Dashboard.
//
// Response:
//   {
//     openAudits:       count — Audits in status planned/preparation/fieldwork/reporting/review
//     openNonconformities: count — checklist_items mit result in (major, minor, nonconforming legacy)
//     overdueRemediations: count — checklist_items mit remediation_deadline < today
//     openFindings:     count — finding.status in (identified, in_remediation)
//     dueSoonFindings:  count — finding.remediation_due_date <= today + 30d
//   }
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const today = new Date().toISOString().slice(0, 10);
  const in30DaysIso = new Date(Date.now() + 30 * 86400000)
    .toISOString()
    .slice(0, 10);

  // Parallelisiert für schnelle Responses — typische Dashboards queryen das.
  const [
    [{ c: openAuditsCount }],
    [{ c: openNonconformitiesCount }],
    [{ c: overdueRemediationsCount }],
    [{ c: openFindingsCount }],
    [{ c: dueSoonFindingsCount }],
  ] = await Promise.all([
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(audit)
      .where(
        and(
          eq(audit.orgId, ctx.orgId),
          isNull(audit.deletedAt),
          inArray(audit.status, [
            "planned",
            "preparation",
            "fieldwork",
            "reporting",
            "review",
          ]),
        ),
      ),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(auditChecklistItem)
      .leftJoin(
        auditChecklist,
        eq(auditChecklistItem.checklistId, auditChecklist.id),
      )
      .where(
        and(
          eq(auditChecklistItem.orgId, ctx.orgId),
          inArray(auditChecklistItem.result, [
            "major_nonconformity",
            "minor_nonconformity",
            "nonconforming",
          ]),
        ),
      ),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(auditChecklistItem)
      .where(
        and(
          eq(auditChecklistItem.orgId, ctx.orgId),
          // Nur NC-Items mit Frist in der Vergangenheit zählen
          inArray(auditChecklistItem.result, [
            "major_nonconformity",
            "minor_nonconformity",
            "nonconforming",
          ]),
          lt(auditChecklistItem.remediationDeadline, today),
        ),
      ),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(finding)
      .where(
        and(
          eq(finding.orgId, ctx.orgId),
          isNull(finding.deletedAt),
          inArray(finding.status, ["identified", "in_remediation"]),
        ),
      ),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(finding)
      .where(
        and(
          eq(finding.orgId, ctx.orgId),
          isNull(finding.deletedAt),
          inArray(finding.status, ["identified", "in_remediation"]),
          lt(finding.remediationDueDate, in30DaysIso),
        ),
      ),
  ]);

  return Response.json({
    data: {
      openAudits: openAuditsCount,
      openNonconformities: openNonconformitiesCount,
      overdueRemediations: overdueRemediationsCount,
      openFindings: openFindingsCount,
      dueSoonFindings: dueSoonFindingsCount,
      today,
    },
  });
}
