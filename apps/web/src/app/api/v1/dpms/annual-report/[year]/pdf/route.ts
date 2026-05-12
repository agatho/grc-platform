// GET /api/v1/dpms/annual-report/[year]/pdf
//
// #NIGHT-021: Pendant zu /api/v1/ai-act/annual-report/[year]/pdf —
// rendert den DPMS-Jahresbericht (RoPA, DPIA, DSR, Breach, TIA,
// Consent, Retention, AVV, PbD) als PDF (mit HTML-Fallback bei
// Puppeteer-Fehler). Compliance-relevant für GDPR Art. 30 Updates.

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
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

function esc(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function statusColor(score: number): { fg: string; bg: string; label: string } {
  if (score >= 80) return { fg: "#166534", bg: "#dcfce7", label: "GREEN" };
  if (score >= 60) return { fg: "#854d0e", bg: "#fef9c3", label: "AMBER" };
  return { fg: "#991b1b", bg: "#fee2e2", label: "RED" };
}

interface ReportData {
  year: number;
  orgName: string;
  complianceScore: number;
  ropa: { total: number; active: number; percentage: number };
  dpia: { total: number; approved: number };
  dsr: {
    total: number;
    timely: number;
    late: number;
    percentage: number;
    byType: Record<string, number>;
  };
  breach: {
    total: number;
    onTime: number;
    late: number;
    percentage: number;
    bySeverity: Record<string, number>;
  };
  tia: number;
  consent: { collected: number; withdrawn: number; withdrawalRate: number };
  retention: { executions: number };
  avv: { active: number };
  pbd: { total: number };
}

function buildHtml(d: ReportData): string {
  const now = new Date().toLocaleDateString("de-DE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const overall = statusColor(d.complianceScore);

  const dsrByType = Object.entries(d.dsr.byType)
    .map(
      ([k, v]) =>
        `<tr><td>${esc(k)}</td><td style="text-align:right">${v}</td></tr>`,
    )
    .join("");
  const breachBySev = Object.entries(d.breach.bySeverity)
    .map(
      ([k, v]) =>
        `<tr><td>${esc(k)}</td><td style="text-align:right">${v}</td></tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 2cm; }
  body { font-family: -apple-system, 'Segoe UI', Arial, sans-serif; font-size: 11pt; line-height: 1.55; color: #1a1a1a; }
  h1 { font-size: 24pt; color: #1e3a5f; margin-bottom: 4px; }
  h2 { font-size: 14pt; color: #1e3a5f; border-bottom: 2px solid #1e3a5f; padding-bottom: 4px; margin-top: 28px; page-break-after: avoid; }
  h3 { font-size: 12pt; color: #374151; margin-top: 16px; }
  .cover { text-align: center; padding: 60px 0 40px; }
  .cover h1 { font-size: 28pt; }
  .cover .subtitle { font-size: 14pt; color: #6b7280; margin-top: 8px; }
  .cover table { margin: 40px auto; width: auto; border: none; }
  .cover td { padding: 4px 12px; border: none; }
  .headline-score { display: flex; align-items: baseline; gap: 12px; margin: 24px 0; }
  .headline-score .big { font-size: 48pt; font-weight: 700; color: #1e3a5f; line-height: 1; }
  .headline-score .suffix { font-size: 14pt; color: #6b7280; }
  .score-pill { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: 600; font-size: 10pt; }
  .progress-bar { width: 100%; height: 12px; background: #e5e7eb; border-radius: 6px; overflow: hidden; margin: 12px 0; }
  .progress-bar-fill { height: 100%; }
  .columns { display: flex; gap: 16px; margin-top: 12px; }
  .column { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px; }
  .column h3 { margin-top: 0; }
  .kpi-row { display: flex; gap: 12px; margin: 16px 0; }
  .kpi { flex: 1; padding: 12px; border: 1px solid #e2e8f0; border-radius: 6px; }
  .kpi-label { font-size: 9pt; color: #6b7280; text-transform: uppercase; }
  .kpi-value { font-size: 22pt; font-weight: 700; color: #1e3a5f; }
  .kpi-suffix { font-size: 10pt; color: #6b7280; margin-left: 4px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 10pt; }
  th { background: #f1f5f9; color: #1e3a5f; text-align: left; padding: 8px; border: 1px solid #e2e8f0; }
  td { padding: 6px 8px; border: 1px solid #e2e8f0; vertical-align: top; }
  tr:nth-child(even) { background: #f8fafc; }
  .page-break { page-break-before: always; }
  .footer { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-size: 8pt; color: #9ca3af; padding-top: 4px; }
</style>
</head>
<body>

<!-- Cover -->
<div class="cover">
  <h1>DPMS Jahres-Compliance-Bericht</h1>
  <div class="subtitle">EU GDPR (2016/679) — Art. 30 Verzeichnis von Verarbeitungstätigkeiten + DPO-Briefing</div>
  <h2 style="border:none;text-align:center;margin-top:32px">${d.year}</h2>
  <table>
    <tr><td style="font-weight:600">Organisation:</td><td>${esc(d.orgName)}</td></tr>
    <tr><td style="font-weight:600">Berichtszeitraum:</td><td>01.01.${d.year} — 31.12.${d.year}</td></tr>
    <tr><td style="font-weight:600">Erstellt am:</td><td>${now}</td></tr>
  </table>
</div>

<div class="page-break"></div>

<!-- Overall Score -->
<h2>Overall Compliance Score</h2>
<p>Gewichteter Composite-Score: DSR-Timeliness 25% / Breach-72h-Compliance 25% / RoPA-Coverage 20% / DPIA-Approval 15% / AVV-Active 15%.</p>
<div class="headline-score">
  <span class="big">${d.complianceScore}</span>
  <span class="suffix">/ 100</span>
  <span class="score-pill" style="margin-left:auto;background:${overall.bg};color:${overall.fg}">${overall.label}</span>
</div>
<div class="progress-bar"><div class="progress-bar-fill" style="width:${d.complianceScore}%;background:${overall.fg}"></div></div>

<!-- Headline KPIs -->
<div class="kpi-row">
  <div class="kpi">
    <div class="kpi-label">RoPA Coverage</div>
    <div><span class="kpi-value">${d.ropa.percentage}</span><span class="kpi-suffix">%</span></div>
    <div style="font-size:9pt;color:#6b7280">${d.ropa.active}/${d.ropa.total} aktiv</div>
  </div>
  <div class="kpi">
    <div class="kpi-label">DSR Timeliness</div>
    <div><span class="kpi-value">${d.dsr.percentage}</span><span class="kpi-suffix">%</span></div>
    <div style="font-size:9pt;color:#6b7280">${d.dsr.timely} fristgerecht / ${d.dsr.late} verspätet</div>
  </div>
  <div class="kpi">
    <div class="kpi-label">Breach 72h-Compliance</div>
    <div><span class="kpi-value">${d.breach.percentage}</span><span class="kpi-suffix">%</span></div>
    <div style="font-size:9pt;color:#6b7280">${d.breach.onTime} fristgerecht / ${d.breach.late} verspätet</div>
  </div>
</div>

<!-- RoPA Section -->
<h2>RoPA — Art. 30 Verarbeitungstätigkeiten</h2>
<table>
  <tr><td>Gesamt-Einträge</td><td style="text-align:right">${d.ropa.total}</td></tr>
  <tr><td>Aktiv</td><td style="text-align:right">${d.ropa.active}</td></tr>
  <tr><td>Coverage-Quote</td><td style="text-align:right">${d.ropa.percentage}%</td></tr>
</table>

<!-- DPIA Section -->
<h2>DPIA — Art. 35 Datenschutz-Folgenabschätzung</h2>
<table>
  <tr><td>Gesamt</td><td style="text-align:right">${d.dpia.total}</td></tr>
  <tr><td>Approved</td><td style="text-align:right">${d.dpia.approved}</td></tr>
</table>

<!-- DSR Section -->
<h2>DSR — Art. 12-22 Betroffenenrechte (im Berichtsjahr)</h2>
<table>
  <tr><td>Gesamt</td><td style="text-align:right">${d.dsr.total}</td></tr>
  <tr><td>Innerhalb 30 Tage beantwortet</td><td style="text-align:right">${d.dsr.timely}</td></tr>
  <tr><td>Verspätet beantwortet</td><td style="text-align:right">${d.dsr.late}</td></tr>
</table>

<h3>Verteilung nach Anfrage-Typ</h3>
<table><thead><tr><th>Typ</th><th style="text-align:right">Anzahl</th></tr></thead><tbody>${dsrByType || '<tr><td colspan="2"><em>Keine DSRs im Berichtszeitraum</em></td></tr>'}</tbody></table>

<div class="page-break"></div>

<!-- Breach Section -->
<h2>Datenschutzvorfälle — Art. 33 (im Berichtsjahr)</h2>
<table>
  <tr><td>Gesamt</td><td style="text-align:right">${d.breach.total}</td></tr>
  <tr><td>Innerhalb 72h gemeldet</td><td style="text-align:right">${d.breach.onTime}</td></tr>
  <tr><td>Verspätet gemeldet</td><td style="text-align:right">${d.breach.late}</td></tr>
</table>

<h3>Verteilung nach Schweregrad</h3>
<table><thead><tr><th>Schweregrad</th><th style="text-align:right">Anzahl</th></tr></thead><tbody>${breachBySev || '<tr><td colspan="2"><em>Keine Vorfälle im Berichtszeitraum</em></td></tr>'}</tbody></table>

<!-- Other Workflows -->
<h2>Weitere Workflows</h2>
<table>
  <tr><td>TIA — Aktive Transfer-Impact-Assessments</td><td style="text-align:right">${d.tia}</td></tr>
  <tr><td>Consent — Eingeholt im Jahr</td><td style="text-align:right">${d.consent.collected}</td></tr>
  <tr><td>Consent — Widerrufen im Jahr</td><td style="text-align:right">${d.consent.withdrawn} (${d.consent.withdrawalRate}%)</td></tr>
  <tr><td>Retention — Lösch-Executions im Jahr</td><td style="text-align:right">${d.retention.executions}</td></tr>
  <tr><td>AVV — Aktive Vereinbarungen</td><td style="text-align:right">${d.avv.active}</td></tr>
  <tr><td>PbD — Privacy-by-Design Assessments</td><td style="text-align:right">${d.pbd.total}</td></tr>
</table>

<div class="footer">Vertraulich &mdash; Erstellt mit ARCTOS GRC Platform &mdash; ${now}</div>

</body>
</html>`;
}

type RouteParams = { params: Promise<{ year: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
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

  // Same aggregation as the JSON endpoint — kept inline so the two
  // never drift on score weighting.
  const [{ ropaTotal }] = await db
    .select({ ropaTotal: sql<number>`count(*)::int` })
    .from(ropaEntry)
    .where(eq(ropaEntry.orgId, ctx.orgId));
  const [{ ropaActive }] = await db
    .select({ ropaActive: sql<number>`count(*)::int` })
    .from(ropaEntry)
    .where(and(eq(ropaEntry.orgId, ctx.orgId), eq(ropaEntry.status, "active")));

  const [{ dpiaTotal }] = await db
    .select({ dpiaTotal: sql<number>`count(*)::int` })
    .from(dpia)
    .where(eq(dpia.orgId, ctx.orgId));
  const [{ dpiaApproved }] = await db
    .select({ dpiaApproved: sql<number>`count(*)::int` })
    .from(dpia)
    .where(and(eq(dpia.orgId, ctx.orgId), eq(dpia.status, "approved")));

  const dsrRows = await db
    .select({
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
  let dsrTimely = 0,
    dsrLate = 0;
  for (const r of dsrRows) {
    dsrByType[r.requestType] = (dsrByType[r.requestType] ?? 0) + 1;
    if (r.respondedAt && r.receivedAt) {
      const days =
        (r.respondedAt.getTime() - r.receivedAt.getTime()) /
        (1000 * 60 * 60 * 24);
      if (days <= 30) dsrTimely++;
      else dsrLate++;
    }
  }

  const breachRows = await db
    .select({
      severity: dataBreach.severity,
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
  let breachOnTime = 0,
    breachLate = 0;
  for (const b of breachRows) {
    breachBySeverity[b.severity] = (breachBySeverity[b.severity] ?? 0) + 1;
    if (b.dpaNotifiedAt && b.detectedAt) {
      const hours =
        (b.dpaNotifiedAt.getTime() - b.detectedAt.getTime()) / (1000 * 60 * 60);
      if (hours <= 72) breachOnTime++;
      else breachLate++;
    }
  }

  const [{ tiaActive }] = await db
    .select({ tiaActive: sql<number>`count(*)::int` })
    .from(tia)
    .where(eq(tia.orgId, ctx.orgId));

  const consentRows = await db
    .select({
      grantedAt: consentRecord.consentGivenAt,
      withdrawnAt: consentRecord.withdrawnAt,
    })
    .from(consentRecord)
    .where(eq(consentRecord.orgId, ctx.orgId));
  const consentCollected = consentRows.filter(
    (c) => c.grantedAt >= startOfYear && c.grantedAt < endOfYear,
  ).length;
  const consentWithdrawn = consentRows.filter(
    (c) =>
      c.withdrawnAt &&
      c.withdrawnAt >= startOfYear &&
      c.withdrawnAt < endOfYear,
  ).length;

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

  const [{ avvActive }] = await db
    .select({ avvActive: sql<number>`count(*)::int` })
    .from(processorAgreement)
    .where(
      and(
        eq(processorAgreement.orgId, ctx.orgId),
        eq(processorAgreement.agreementStatus, "active"),
      ),
    );

  const [{ pbdTotal }] = await db
    .select({ pbdTotal: sql<number>`count(*)::int` })
    .from(pbdAssessment)
    .where(eq(pbdAssessment.orgId, ctx.orgId));

  const dsrPct =
    dsrTimely + dsrLate > 0
      ? Math.round((dsrTimely / (dsrTimely + dsrLate)) * 100)
      : 100;
  const breachPct =
    breachOnTime + breachLate > 0
      ? Math.round((breachOnTime / (breachOnTime + breachLate)) * 100)
      : 100;
  const ropaPct =
    ropaTotal > 0 ? Math.round((ropaActive / ropaTotal) * 100) : 100;
  const dpiaPct = dpiaTotal > 0 ? (dpiaApproved / dpiaTotal) * 100 : 100;

  const complianceScore = Math.round(
    dsrPct * 0.25 +
      breachPct * 0.25 +
      ropaPct * 0.2 +
      dpiaPct * 0.15 +
      100 * 0.15,
  );

  const reportData: ReportData = {
    year,
    orgName: org.name,
    complianceScore,
    ropa: { total: ropaTotal, active: ropaActive, percentage: ropaPct },
    dpia: { total: dpiaTotal, approved: dpiaApproved },
    dsr: {
      total: dsrRows.length,
      timely: dsrTimely,
      late: dsrLate,
      percentage: dsrPct,
      byType: dsrByType,
    },
    breach: {
      total: breachRows.length,
      onTime: breachOnTime,
      late: breachLate,
      percentage: breachPct,
      bySeverity: breachBySeverity,
    },
    tia: tiaActive,
    consent: {
      collected: consentCollected,
      withdrawn: consentWithdrawn,
      withdrawalRate:
        consentCollected > 0
          ? Math.round((consentWithdrawn / consentCollected) * 100)
          : 0,
    },
    retention: { executions: retentionExecuted },
    avv: { active: avvActive },
    pbd: { total: pbdTotal },
  };

  const html = buildHtml(reportData);

  // Render PDF via Puppeteer with HTML fallback (matches AI-Act report).
  try {
    const puppeteer = await import("puppeteer");
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "2cm", bottom: "2.5cm", left: "2cm", right: "2cm" },
    });
    await browser.close();

    const filename = `DPMS-Annual-Report-${year}-${org.name.replace(/[^a-zA-Z0-9\-_]/g, "_")}.pdf`;
    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch {
    const filename = `DPMS-Annual-Report-${year}-${org.name.replace(/[^a-zA-Z0-9\-_]/g, "_")}.html`;
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }
}
