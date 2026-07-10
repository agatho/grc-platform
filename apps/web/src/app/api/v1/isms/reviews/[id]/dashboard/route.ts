// GET /api/v1/isms/reviews/[id]/dashboard
//
// Management-Review-Cockpit (ISO 27001 Kap. 9.3): aggregiert die
// 9.3.2-Pflicht-Inputs für den Review-Zeitraum aus den real
// existierenden Datenquellen der Plattform:
//
//   (a) previousActions      — Maßnahmen aus dem letzten completed Review
//                              (management_review_item → work_item-Status)
//   (b) risks                — Risiko-Lage (Status, neue/geschlossene im
//                              Zeitraum, Top-Risiken, offene Risk-Acceptances)
//   (c) findings             — Nichtkonformitäten offen/geschlossen/überfällig
//   (d) audits               — abgeschlossene Audits im Zeitraum
//   (e) controlEffectiveness — control_test-Aggregat (ToE-Ergebnis) im Zeitraum
//   (f) incidents            — Security-Incidents im Zeitraum
//   (g) documents            — überfällige Dokumenten-Reviews
//   (h) kpis                 — KRI-Ampel-Status (rote KRIs im Detail)
//
// Zeitraum: ?from/&to-Override > period_start/period_end am Review >
// seit letztem completed Review > 12 Monate (siehe lib/isms/review-period).
// Alle Queries laufen parallel (Promise.all) und sind org-gescoped.

import {
  db,
  managementReview,
  managementReviewItem,
  workItem,
  risk,
  riskAcceptance,
  finding,
  audit,
  controlTest,
  securityIncident,
  document,
  kri,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, ne, lte, lt, gte, isNull, isNotNull, desc, asc, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { resolveReviewPeriod } from "@/lib/isms/review-period";

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const { searchParams } = new URL(req.url);

  const reviewRows = await db
    .select()
    .from(managementReview)
    .where(
      and(eq(managementReview.id, id), eq(managementReview.orgId, ctx.orgId)),
    );
  const review = reviewRows[0];
  if (!review) {
    return Response.json({ error: "Review not found" }, { status: 404 });
  }

  // Letztes abgeschlossenes Review vor diesem — liefert (1) den
  // Default-Zeitraumbeginn und (2) die Quelle für Input (a).
  const prevRows = await db
    .select({
      id: managementReview.id,
      title: managementReview.title,
      reviewDate: managementReview.reviewDate,
      actionItems: managementReview.actionItems,
    })
    .from(managementReview)
    .where(
      and(
        eq(managementReview.orgId, ctx.orgId),
        eq(managementReview.status, "completed"),
        ne(managementReview.id, id),
        lte(managementReview.reviewDate, review.reviewDate),
      ),
    )
    .orderBy(desc(managementReview.reviewDate))
    .limit(1);
  const prevReview = prevRows[0] ?? null;

  const period = resolveReviewPeriod({
    review: {
      reviewDate: review.reviewDate,
      periodStart: review.periodStart,
      periodEnd: review.periodEnd,
    },
    lastCompletedReviewDate: prevReview?.reviewDate ?? null,
    overrideFrom: searchParams.get("from"),
    overrideTo: searchParams.get("to"),
  });

  const from = period.from;
  const to = period.to;
  // date-typed Spalten (audit.actual_end, control_test.test_date,
  // finding.remediation_due_date) vergleichen wir als YYYY-MM-DD-Strings.
  const fromStr = toDateString(from);
  const toStr = toDateString(to);
  const todayStr = toDateString(new Date());
  const now = new Date();

  const count = sql<number>`count(*)::int`;

  const [
    // (a) Maßnahmen aus dem letzten Review
    prevActionRows,
    // (b) Risiko-Lage
    riskByStatusRows,
    riskNewRows,
    riskClosedRows,
    topRiskRows,
    acceptanceCountRows,
    acceptanceRows,
    // (c) Findings / Nichtkonformitäten
    findingByStatusRows,
    findingClosedRows,
    findingOverdueRows,
    // (d) Audits
    auditRows,
    // (e) Kontroll-Wirksamkeit
    controlTestRows,
    // (f) Incidents
    incidentBySeverityRows,
    incidentByStatusRows,
    recentIncidentRows,
    // (g) Dokumente
    docOverdueCountRows,
    docOverdueRows,
    // (h) KPIs / KRIs
    kriByAlertRows,
    kriRedRows,
  ] = await Promise.all([
    prevReview
      ? db
          .select({
            id: managementReviewItem.id,
            category: managementReviewItem.category,
            content: managementReviewItem.content,
            decision: managementReviewItem.decision,
            actionWorkItemId: managementReviewItem.actionWorkItemId,
            actionElementId: workItem.elementId,
            actionName: workItem.name,
            actionStatus: workItem.status,
            actionDueDate: workItem.dueDate,
          })
          .from(managementReviewItem)
          .leftJoin(
            workItem,
            eq(managementReviewItem.actionWorkItemId, workItem.id),
          )
          .where(
            and(
              eq(managementReviewItem.orgId, ctx.orgId),
              eq(managementReviewItem.reviewId, prevReview.id),
              isNotNull(managementReviewItem.actionWorkItemId),
            ),
          )
          .orderBy(asc(managementReviewItem.sortOrder))
      : Promise.resolve([]),
    db
      .select({ status: risk.status, count })
      .from(risk)
      .where(and(eq(risk.orgId, ctx.orgId), isNull(risk.deletedAt)))
      .groupBy(risk.status),
    db
      .select({ count })
      .from(risk)
      .where(
        and(
          eq(risk.orgId, ctx.orgId),
          isNull(risk.deletedAt),
          gte(risk.createdAt, from),
          lte(risk.createdAt, to),
        ),
      ),
    db
      .select({ count })
      .from(risk)
      .where(
        and(
          eq(risk.orgId, ctx.orgId),
          isNull(risk.deletedAt),
          eq(risk.status, "closed"),
          gte(risk.updatedAt, from),
          lte(risk.updatedAt, to),
        ),
      ),
    db
      .select({
        id: risk.id,
        title: risk.title,
        status: risk.status,
        riskScoreResidual: risk.riskScoreResidual,
      })
      .from(risk)
      .where(
        and(
          eq(risk.orgId, ctx.orgId),
          isNull(risk.deletedAt),
          ne(risk.status, "closed"),
          isNotNull(risk.riskScoreResidual),
        ),
      )
      .orderBy(desc(risk.riskScoreResidual))
      .limit(5),
    db
      .select({ count })
      .from(riskAcceptance)
      .where(
        and(
          eq(riskAcceptance.orgId, ctx.orgId),
          eq(riskAcceptance.status, "active"),
        ),
      ),
    db
      .select({
        id: riskAcceptance.id,
        riskId: riskAcceptance.riskId,
        riskTitle: risk.title,
        validUntil: riskAcceptance.validUntil,
        riskLevelAtAcceptance: riskAcceptance.riskLevelAtAcceptance,
      })
      .from(riskAcceptance)
      .leftJoin(risk, eq(riskAcceptance.riskId, risk.id))
      .where(
        and(
          eq(riskAcceptance.orgId, ctx.orgId),
          eq(riskAcceptance.status, "active"),
        ),
      )
      .orderBy(sql`${riskAcceptance.validUntil} ASC NULLS LAST`)
      .limit(10),
    db
      .select({ status: finding.status, count })
      .from(finding)
      .where(and(eq(finding.orgId, ctx.orgId), isNull(finding.deletedAt)))
      .groupBy(finding.status),
    db
      .select({ count })
      .from(finding)
      .where(
        and(
          eq(finding.orgId, ctx.orgId),
          isNull(finding.deletedAt),
          eq(finding.status, "closed"),
          gte(finding.updatedAt, from),
          lte(finding.updatedAt, to),
        ),
      ),
    db
      .select({
        id: finding.id,
        title: finding.title,
        severity: finding.severity,
        status: finding.status,
        remediationDueDate: finding.remediationDueDate,
      })
      .from(finding)
      .where(
        and(
          eq(finding.orgId, ctx.orgId),
          isNull(finding.deletedAt),
          sql`${finding.status} IN ('identified', 'in_remediation')`,
          isNotNull(finding.remediationDueDate),
          lt(finding.remediationDueDate, todayStr),
        ),
      )
      .orderBy(asc(finding.remediationDueDate))
      .limit(10),
    db
      .select({
        id: audit.id,
        title: audit.title,
        auditType: audit.auditType,
        conclusion: audit.conclusion,
        actualEnd: audit.actualEnd,
        findingCount: audit.findingCount,
      })
      .from(audit)
      .where(
        and(
          eq(audit.orgId, ctx.orgId),
          isNull(audit.deletedAt),
          eq(audit.status, "completed"),
          isNotNull(audit.actualEnd),
          gte(audit.actualEnd, fromStr),
          lte(audit.actualEnd, toStr),
        ),
      )
      .orderBy(desc(audit.actualEnd))
      .limit(20),
    db
      .select({ result: controlTest.toeResult, count })
      .from(controlTest)
      .where(
        and(
          eq(controlTest.orgId, ctx.orgId),
          isNull(controlTest.deletedAt),
          eq(controlTest.status, "completed"),
          isNotNull(controlTest.testDate),
          gte(controlTest.testDate, fromStr),
          lte(controlTest.testDate, toStr),
        ),
      )
      .groupBy(controlTest.toeResult),
    db
      .select({ severity: securityIncident.severity, count })
      .from(securityIncident)
      .where(
        and(
          eq(securityIncident.orgId, ctx.orgId),
          isNull(securityIncident.deletedAt),
          gte(securityIncident.detectedAt, from),
          lte(securityIncident.detectedAt, to),
        ),
      )
      .groupBy(securityIncident.severity),
    db
      .select({ status: securityIncident.status, count })
      .from(securityIncident)
      .where(
        and(
          eq(securityIncident.orgId, ctx.orgId),
          isNull(securityIncident.deletedAt),
          gte(securityIncident.detectedAt, from),
          lte(securityIncident.detectedAt, to),
        ),
      )
      .groupBy(securityIncident.status),
    db
      .select({
        id: securityIncident.id,
        elementId: securityIncident.elementId,
        title: securityIncident.title,
        severity: securityIncident.severity,
        status: securityIncident.status,
        detectedAt: securityIncident.detectedAt,
      })
      .from(securityIncident)
      .where(
        and(
          eq(securityIncident.orgId, ctx.orgId),
          isNull(securityIncident.deletedAt),
          gte(securityIncident.detectedAt, from),
          lte(securityIncident.detectedAt, to),
        ),
      )
      .orderBy(desc(securityIncident.detectedAt))
      .limit(10),
    db
      .select({ count })
      .from(document)
      .where(
        and(
          eq(document.orgId, ctx.orgId),
          isNull(document.deletedAt),
          ne(document.status, "archived"),
          isNotNull(document.reviewDate),
          lt(document.reviewDate, now),
        ),
      ),
    db
      .select({
        id: document.id,
        title: document.title,
        category: document.category,
        status: document.status,
        reviewDate: document.reviewDate,
      })
      .from(document)
      .where(
        and(
          eq(document.orgId, ctx.orgId),
          isNull(document.deletedAt),
          ne(document.status, "archived"),
          isNotNull(document.reviewDate),
          lt(document.reviewDate, now),
        ),
      )
      .orderBy(asc(document.reviewDate))
      .limit(10),
    db
      .select({ alertStatus: kri.currentAlertStatus, count })
      .from(kri)
      .where(and(eq(kri.orgId, ctx.orgId), isNull(kri.deletedAt)))
      .groupBy(kri.currentAlertStatus),
    db
      .select({
        id: kri.id,
        name: kri.name,
        currentValue: kri.currentValue,
        unit: kri.unit,
        trend: kri.trend,
        lastMeasuredAt: kri.lastMeasuredAt,
      })
      .from(kri)
      .where(
        and(
          eq(kri.orgId, ctx.orgId),
          isNull(kri.deletedAt),
          eq(kri.currentAlertStatus, "red"),
        ),
      )
      .orderBy(desc(kri.lastMeasuredAt))
      .limit(10),
  ]);

  const toRecord = <K extends string>(
    rows: Array<{ [key in K]: string | null } & { count: number }>,
    key: K,
  ): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const row of rows) {
      out[row[key] ?? "unknown"] = row.count;
    }
    return out;
  };

  const risksByStatus = toRecord(riskByStatusRows, "status");
  const findingsByStatus = toRecord(findingByStatusRows, "status");
  const openFindings =
    (findingsByStatus["identified"] ?? 0) +
    (findingsByStatus["in_remediation"] ?? 0);

  return Response.json({
    data: {
      review: {
        id: review.id,
        title: review.title,
        reviewDate: review.reviewDate,
        status: review.status,
      },
      period: {
        from: fromStr,
        to: toStr,
        source: period.source,
      },
      previousActions: {
        review: prevReview
          ? {
              id: prevReview.id,
              title: prevReview.title,
              reviewDate: prevReview.reviewDate,
            }
          : null,
        items: prevActionRows,
        // Legacy-jsonb-Maßnahmen des Vorgänger-Reviews (Bestand vor 0369)
        legacyActionItems: prevReview?.actionItems ?? null,
      },
      risks: {
        byStatus: risksByStatus,
        newInPeriod: riskNewRows[0]?.count ?? 0,
        closedInPeriod: riskClosedRows[0]?.count ?? 0,
        top: topRiskRows,
        acceptances: {
          activeCount: acceptanceCountRows[0]?.count ?? 0,
          expiringSoonest: acceptanceRows,
        },
      },
      findings: {
        byStatus: findingsByStatus,
        open: openFindings,
        closedInPeriod: findingClosedRows[0]?.count ?? 0,
        overdue: findingOverdueRows,
        overdueCount: findingOverdueRows.length,
      },
      audits: {
        completedInPeriod: auditRows,
        completedCount: auditRows.length,
      },
      controlEffectiveness: {
        byToeResult: toRecord(controlTestRows, "result"),
        testedInPeriod: controlTestRows.reduce((acc, r) => acc + r.count, 0),
      },
      incidents: {
        bySeverity: toRecord(incidentBySeverityRows, "severity"),
        byStatus: toRecord(incidentByStatusRows, "status"),
        totalInPeriod: incidentBySeverityRows.reduce(
          (acc, r) => acc + r.count,
          0,
        ),
        recent: recentIncidentRows,
      },
      documents: {
        overdueReviewCount: docOverdueCountRows[0]?.count ?? 0,
        overdue: docOverdueRows,
      },
      kpis: {
        byAlertStatus: toRecord(kriByAlertRows, "alertStatus"),
        red: kriRedRows,
      },
    },
  });
}
