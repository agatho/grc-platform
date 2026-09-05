// GET /api/v1/dpms/annual-report/[year]
//
// Sprint 3.6: Annual-DPMS-Report. Aggregiert alle 9 parallelen Workflows
// (RoPA, DPIA, DSR, Breach, TIA, Consent, Retention, AVV, PbD) in einen
// Jahres-Snapshot fuer DPO-Briefing + Management-Review.

import {
  db,
  ropaEntry,
  dpia,
  dsr,
  dataBreach,
  tia,
  consentRecord,
  deletionRequest,
  processorAgreement,
  pbdAssessment,
  organization,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { and, eq, isNull, gte, lte, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

type RouteParams = { params: Promise<{ year: string }> };

export const GET = withErrorHandler(async function GET(
  _req: Request,
  { params }: RouteParams,
) {
  const { year: yearStr } = await params;
  const year = parseInt(yearStr, 10);
  if (isNaN(year) || year < 2000 || year > 3000) {
    return Response.json({ error: "Invalid year" }, { status: 400 });
  }

  const ctx = await withAuth("admin", "dpo");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dpms", ctx.orgId, "GET");
  if (moduleCheck) return moduleCheck;

  const startOfYear = new Date(Date.UTC(year, 0, 1));
  const endOfYear = new Date(Date.UTC(year + 1, 0, 1));

  const [org] = await db
    .select({ id: organization.id, name: organization.name })
    .from(organization)
    .where(eq(organization.id, ctx.orgId));
  if (!org) {
    return Response.json({ error: "Organization not found" }, { status: 404 });
  }

  // #WP8-S07-17 — Der Jahresbericht ist der Rechenschaftsnachweis nach
  // Art. 5(2)/Art. 30 gegenüber der Aufsichtsbehörde. Er zählte
  // soft-gelöschte Verarbeitungstätigkeiten, DSFAs und TIAs mit: eine
  // Organisation, die zwölf veraltete Verarbeitungen gelöscht hat, wies
  // sie im Nachweis weiterhin aus. Alle Zählpfade filtern jetzt
  // `deleted_at IS NULL`.
  // RoPA-Coverage
  const [{ ropaTotal }] = await db
    .select({ ropaTotal: sql<number>`count(*)::int` })
    .from(ropaEntry)
    .where(and(eq(ropaEntry.orgId, ctx.orgId), isNull(ropaEntry.deletedAt)));

  const [{ ropaActive }] = await db
    .select({ ropaActive: sql<number>`count(*)::int` })
    .from(ropaEntry)
    .where(
      and(
        eq(ropaEntry.orgId, ctx.orgId),
        eq(ropaEntry.status, "active"),
        isNull(ropaEntry.deletedAt),
      ),
    );

  // DPIA-Stats
  const [{ dpiaTotal }] = await db
    .select({ dpiaTotal: sql<number>`count(*)::int` })
    .from(dpia)
    .where(and(eq(dpia.orgId, ctx.orgId), isNull(dpia.deletedAt)));

  const [{ dpiaApproved }] = await db
    .select({ dpiaApproved: sql<number>`count(*)::int` })
    .from(dpia)
    .where(
      and(
        eq(dpia.orgId, ctx.orgId),
        eq(dpia.status, "approved"),
        isNull(dpia.deletedAt),
      ),
    );

  // DSR-Stats im Jahr
  const dsrRows = await db
    .select({
      id: dsr.id,
      status: dsr.status,
      requestType: dsr.requestType,
      receivedAt: dsr.receivedAt,
      respondedAt: dsr.respondedAt,
    })
    .from(dsr)
    .where(
      and(
        eq(dsr.orgId, ctx.orgId),
        gte(dsr.receivedAt, startOfYear),
        lte(dsr.receivedAt, endOfYear),
      ),
    );

  const dsrByType: Record<string, number> = {};
  const dsrByStatus: Record<string, number> = {};
  let dsrTimelyCount = 0;
  let dsrLateCount = 0;
  for (const r of dsrRows) {
    dsrByType[r.requestType] = (dsrByType[r.requestType] ?? 0) + 1;
    dsrByStatus[r.status] = (dsrByStatus[r.status] ?? 0) + 1;
    if (r.respondedAt && r.receivedAt) {
      const days =
        (r.respondedAt.getTime() - r.receivedAt.getTime()) /
        (1000 * 60 * 60 * 24);
      if (days <= 30) dsrTimelyCount++;
      else dsrLateCount++;
    }
  }

  // Breach-Stats im Jahr
  const breachRows = await db
    .select({
      id: dataBreach.id,
      severity: dataBreach.severity,
      status: dataBreach.status,
      detectedAt: dataBreach.detectedAt,
      dpaNotifiedAt: dataBreach.dpaNotifiedAt,
    })
    .from(dataBreach)
    .where(
      and(
        eq(dataBreach.orgId, ctx.orgId),
        gte(dataBreach.detectedAt, startOfYear),
        lte(dataBreach.detectedAt, endOfYear),
      ),
    );

  const breachBySeverity: Record<string, number> = {};
  let breachOnTimeCount = 0;
  let breachLateCount = 0;
  for (const b of breachRows) {
    breachBySeverity[b.severity] = (breachBySeverity[b.severity] ?? 0) + 1;
    if (b.dpaNotifiedAt && b.detectedAt) {
      const hours =
        (b.dpaNotifiedAt.getTime() - b.detectedAt.getTime()) / (1000 * 60 * 60);
      if (hours <= 72) breachOnTimeCount++;
      else breachLateCount++;
    }
  }

  // TIA-Count
  const [{ tiaActive }] = await db
    .select({ tiaActive: sql<number>`count(*)::int` })
    .from(tia)
    .where(and(eq(tia.orgId, ctx.orgId), isNull(tia.deletedAt)));

  // Consent-Stats im Jahr
  const consentRows = await db
    .select({
      grantedAt: consentRecord.consentGivenAt,
      withdrawnAt: consentRecord.withdrawnAt,
    })
    .from(consentRecord)
    .where(eq(consentRecord.orgId, ctx.orgId));

  const consentTotalInYear = consentRows.filter(
    (c) => c.grantedAt >= startOfYear && c.grantedAt < endOfYear,
  ).length;
  const consentWithdrawnInYear = consentRows.filter(
    (c) =>
      c.withdrawnAt &&
      c.withdrawnAt >= startOfYear &&
      c.withdrawnAt < endOfYear,
  ).length;

  // Retention-Executions
  const [{ retentionExecuted }] = await db
    .select({ retentionExecuted: sql<number>`count(*)::int` })
    .from(deletionRequest)
    .where(
      and(
        eq(deletionRequest.orgId, ctx.orgId),
        gte(deletionRequest.createdAt, startOfYear),
        lte(deletionRequest.createdAt, endOfYear),
      ),
    );

  // AVV-Stats
  const [{ avvActive }] = await db
    .select({ avvActive: sql<number>`count(*)::int` })
    .from(processorAgreement)
    .where(
      and(
        eq(processorAgreement.orgId, ctx.orgId),
        eq(processorAgreement.agreementStatus, "active"),
      ),
    );

  // PbD-Assessments
  const [{ pbdTotal }] = await db
    .select({ pbdTotal: sql<number>`count(*)::int` })
    .from(pbdAssessment)
    .where(eq(pbdAssessment.orgId, ctx.orgId));

  // GDPR-Compliance-Score (Composite)
  // Gewichtung:
  // - DSR-Timeliness 25 %
  // - Breach-72h-Compliance 25 %
  // - RoPA-Coverage 20 %
  // - DPIA-Approval-Rate 15 %
  // - AVV-Active-Rate 15 %
  const dsrScore =
    dsrTimelyCount + dsrLateCount > 0
      ? (dsrTimelyCount / (dsrTimelyCount + dsrLateCount)) * 100
      : 100;
  const breachScore =
    breachOnTimeCount + breachLateCount > 0
      ? (breachOnTimeCount / (breachOnTimeCount + breachLateCount)) * 100
      : 100;
  const ropaScore = ropaTotal > 0 ? (ropaActive / ropaTotal) * 100 : 100;
  const dpiaScore = dpiaTotal > 0 ? (dpiaApproved / dpiaTotal) * 100 : 100;
  const avvScore = 100; // Platzhalter -- bei detaillierteren Zahlen berechnen

  const complianceScore = Math.round(
    dsrScore * 0.25 +
      breachScore * 0.25 +
      ropaScore * 0.2 +
      dpiaScore * 0.15 +
      avvScore * 0.15,
  );

  return Response.json({
    data: {
      generatedAt: new Date().toISOString(),
      year,
      org: { id: org.id, name: org.name },
      complianceScore,
      executive: {
        complianceScore,
        ropaCoverage: {
          total: ropaTotal,
          active: ropaActive,
          percentage: Math.round(ropaScore),
        },
        dsrTimeliness: {
          timely: dsrTimelyCount,
          late: dsrLateCount,
          percentage: Math.round(dsrScore),
        },
        breachCompliance: {
          onTime: breachOnTimeCount,
          late: breachLateCount,
          percentage: Math.round(breachScore),
        },
      },
      ropa: { total: ropaTotal, active: ropaActive },
      dpia: { total: dpiaTotal, approved: dpiaApproved },
      dsr: {
        totalInYear: dsrRows.length,
        byType: dsrByType,
        byStatus: dsrByStatus,
        timelyCount: dsrTimelyCount,
        lateCount: dsrLateCount,
      },
      breach: {
        totalInYear: breachRows.length,
        bySeverity: breachBySeverity,
        on72hTime: breachOnTimeCount,
        late: breachLateCount,
      },
      tia: { active: tiaActive },
      consent: {
        collectedInYear: consentTotalInYear,
        withdrawnInYear: consentWithdrawnInYear,
        withdrawalRate:
          consentTotalInYear > 0
            ? Math.round((consentWithdrawnInYear / consentTotalInYear) * 100)
            : 0,
      },
      retention: { executionsInYear: retentionExecuted },
      avv: { active: avvActive },
      pbd: { total: pbdTotal },
    },
  });
});
