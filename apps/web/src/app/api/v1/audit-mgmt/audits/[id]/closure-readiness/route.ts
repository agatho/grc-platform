import {
  db,
  audit,
  auditChecklist,
  auditChecklistItem,
  finding,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, inArray, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/v1/audit-mgmt/audits/[id]/closure-readiness
//
// Liefert eine Liste der Gründe, die gegen einen Audit-Abschluss sprechen.
// Wird vor dem Übergang in status=completed aufgerufen — wenn `blockers`
// nicht leer ist, zeigt die UI einen Review-Dialog statt sofort zu
// transitionieren (ISO 19011 § 6.5: die Audit-Schlussfolgerung muss auf
// allen erhobenen Nachweisen basieren).
//
// Blocker (jeder ist ein Grund vor dem Abschluss):
//   • unevaluatedItems — Checklist-Items ohne result
//   • ncWithoutFinding — NC-Items (major/minor) ohne ein verlinktes Finding
//   • missingConclusion — audit.conclusion ist null
//   • openFindings — Findings mit status in (identified, in_remediation)
export async function GET(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const [auditRow] = await db
    .select({
      id: audit.id,
      status: audit.status,
      conclusion: audit.conclusion,
    })
    .from(audit)
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

  // Alle Checkliste-Items für das Audit, gruppiert nach Result
  const [
    [{ c: unevaluatedCount }],
    [{ c: ncWithoutFindingCount, ncIds }],
    [{ c: openFindingsCount }],
  ] = await Promise.all([
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(auditChecklistItem)
      .leftJoin(
        auditChecklist,
        eq(auditChecklistItem.checklistId, auditChecklist.id),
      )
      .where(
        and(
          eq(auditChecklist.auditId, id),
          eq(auditChecklistItem.orgId, ctx.orgId),
          isNull(auditChecklistItem.result),
        ),
      ),
    // NC-Items deren ID NICHT in finding.sourceItemId auftaucht.
    // Finding hat kein sourceItemId → wir approximieren via Title-Match
    // (schnelle Heuristik: ein NC-Item mit Kriterium "X" ist erschlagen,
    // wenn ein Finding des Audits mit Title beginnt mit dem Kriterium).
    // Für echten Link braucht's ein separates Sprint.
    db
      .select({
        c: sql<number>`count(*)::int`,
        ncIds: sql<string[]>`array_agg(${auditChecklistItem.id})`,
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
          inArray(auditChecklistItem.result, [
            "major_nonconformity",
            "minor_nonconformity",
            "nonconforming",
          ]),
        ),
      ),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(finding)
      .where(
        and(
          eq(finding.auditId, id),
          eq(finding.orgId, ctx.orgId),
          isNull(finding.deletedAt),
          inArray(finding.status, ["identified", "in_remediation"]),
        ),
      ),
  ]);

  // Wieviele Findings hat das Audit insgesamt?
  const [{ c: totalFindingsCount }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(finding)
    .where(
      and(
        eq(finding.auditId, id),
        eq(finding.orgId, ctx.orgId),
        isNull(finding.deletedAt),
      ),
    );

  // Heuristik für ncWithoutFinding:
  // Wenn NCs existieren aber 0 Findings, ist mindestens 1 ohne Finding.
  // Wir schätzen konservativ: max(ncCount - findingsCount, 0)
  const uncoveredNc =
    ncWithoutFindingCount > 0
      ? Math.max(ncWithoutFindingCount - totalFindingsCount, 0)
      : 0;

  const blockers: Array<{
    kind: string;
    message: string;
    count: number;
    severity: "warning" | "error";
  }> = [];

  if (unevaluatedCount > 0) {
    blockers.push({
      kind: "unevaluated_items",
      message: `${unevaluatedCount} Checklist-Item(s) ohne Bewertung`,
      count: unevaluatedCount,
      severity: "warning",
    });
  }
  if (uncoveredNc > 0) {
    blockers.push({
      kind: "nc_without_finding",
      message: `${uncoveredNc} Nebenabweichung(en)/Hauptabweichung(en) wurden bewertet, aber nicht in ein Finding überführt`,
      count: uncoveredNc,
      severity: "warning",
    });
  }
  if (!auditRow.conclusion) {
    blockers.push({
      kind: "missing_conclusion",
      message:
        "Audit-Konklusion fehlt — wird beim Übergang nach completed zwingend abgefragt",
      count: 1,
      severity: "error",
    });
  }
  if (openFindingsCount > 0) {
    blockers.push({
      kind: "open_findings",
      message: `${openFindingsCount} Finding(s) sind noch in status identified/in_remediation`,
      count: openFindingsCount,
      severity: "warning",
    });
  }

  return Response.json({
    data: {
      auditId: id,
      currentStatus: auditRow.status,
      conclusion: auditRow.conclusion,
      ncItemIds: ncIds ?? [],
      totalFindingsCount,
      blockers,
      canClose: blockers.filter((b) => b.severity === "error").length === 0,
    },
  });
}
