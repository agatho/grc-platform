// GET /api/v1/ai-act/annual-report/[year]/pdf
//
// Puppeteer-rendered PDF variant of the Sprint 5.7 annual report. Share the
// same aggregation as the JSON endpoint (reuse computeAnnualReport helper) so
// the PDF, the UI, and the dashboard composite never drift.

import {
  db,
  aiSystem,
  aiConformityAssessment,
  aiFria,
  aiIncident,
  aiCorrectiveAction,
  aiGpaiModel,
  aiProviderQms,
  organization,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import {
  computeAnnualReport,
  assessQmsReadinessForCe,
  type AnnualReportInput,
  type QmsProcedureChecklist,
} from "@grc/shared";
import { and, eq, sql, isNull, gte, lt } from "drizzle-orm";
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

function buildAnnualReportHTML(
  year: number,
  orgName: string,
  report: ReturnType<typeof computeAnnualReport>,
  input: AnnualReportInput,
): string {
  const now = new Date().toLocaleDateString("de-DE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const overall = statusColor(report.overallComplianceScore);

  const sectionCards = Object.entries(report.sections)
    .map(([key, section]) => {
      const color = statusColor(section.healthScore);
      return `<div class="section-card">
        <div class="section-card-header">
          <div class="section-card-title">${esc(keyLabel(key))}</div>
          <div class="score-pill" style="background:${color.bg};color:${color.fg}">
            ${section.healthScore}/100
          </div>
        </div>
        <div class="section-card-bar">
          <div class="section-card-bar-fill" style="width:${section.healthScore}%;background:${color.fg}"></div>
        </div>
        <p class="section-card-narrative">${esc(section.narrative)}</p>
      </div>`;
    })
    .join("");

  const criticalList = report.criticalFindings.length
    ? report.criticalFindings.map((f) => `<li class="critical">${esc(f)}</li>`).join("")
    : "<li><em>Keine kritischen Befunde.</em></li>";

  const highlightList = report.highlights.length
    ? report.highlights.map((h) => `<li class="highlight">${esc(h)}</li>`).join("")
    : "<li><em>Keine hervorgehobenen Erfolge.</em></li>";

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
  .cover .meta { margin-top: 40px; font-size: 11pt; color: #6b7280; }
  .cover .meta td { padding: 4px 12px; border: none; }
  .headline-score { display: flex; align-items: baseline; gap: 12px; margin: 24px 0; }
  .headline-score .big { font-size: 48pt; font-weight: 700; color: #1e3a5f; line-height: 1; }
  .headline-score .suffix { font-size: 14pt; color: #6b7280; }
  .score-pill { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: 600; font-size: 10pt; }
  .progress-bar { width: 100%; height: 12px; background: #e5e7eb; border-radius: 6px; overflow: hidden; margin: 12px 0; }
  .progress-bar-fill { height: 100%; }
  .readiness-badge { display: inline-block; padding: 6px 14px; border-radius: 4px; font-weight: 600; font-size: 11pt; margin-top: 12px; }
  ul { list-style: none; padding-left: 0; }
  ul li { padding: 6px 0 6px 18px; position: relative; }
  ul li.critical::before { content: "⚠"; position: absolute; left: 0; color: #dc2626; font-weight: bold; }
  ul li.highlight::before { content: "✓"; position: absolute; left: 0; color: #059669; font-weight: bold; }
  .columns { display: flex; gap: 16px; margin-top: 12px; }
  .column { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px; }
  .column h3 { margin-top: 0; }
  .section-card { border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px; margin-bottom: 12px; page-break-inside: avoid; }
  .section-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .section-card-title { font-weight: 600; font-size: 12pt; color: #1e3a5f; }
  .section-card-bar { width: 100%; height: 6px; background: #e5e7eb; border-radius: 3px; overflow: hidden; margin-bottom: 8px; }
  .section-card-bar-fill { height: 100%; }
  .section-card-narrative { font-size: 10pt; color: #4b5563; margin: 0; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 10pt; }
  th { background: #f1f5f9; color: #1e3a5f; text-align: left; padding: 8px; border: 1px solid #e2e8f0; }
  td { padding: 6px 8px; border: 1px solid #e2e8f0; vertical-align: top; }
  tr:nth-child(even) { background: #f8fafc; }
  .text-red { color: #dc2626; }
  .text-emerald { color: #059669; }
  .text-amber { color: #b45309; }
  .page-break { page-break-before: always; }
  .footer { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-size: 8pt; color: #9ca3af; padding-top: 4px; }
</style>
</head>
<body>

<!-- Cover -->
<div class="cover">
  <h1>AI-Act Annual Compliance Report</h1>
  <div class="subtitle">EU AI Act 2024/1689 — Providers &amp; Deployers</div>
  <h2 style="border:none;text-align:center;margin-top:32px">${year}</h2>
  <table style="margin:40px auto;width:auto;border:none">
    <tr><td style="font-weight:600">Organisation:</td><td>${esc(orgName)}</td></tr>
    <tr><td style="font-weight:600">Berichtszeitraum:</td><td>01.01.${year} — 31.12.${year}</td></tr>
    <tr><td style="font-weight:600">Erstellt am:</td><td>${now}</td></tr>
    <tr>
      <td style="font-weight:600">Einreichungsstatus:</td>
      <td>
        <span class="readiness-badge" style="background:${report.readyForSubmission ? "#dcfce7" : "#fee2e2"};color:${report.readyForSubmission ? "#166534" : "#991b1b"}">
          ${report.readyForSubmission ? "EINREICHBAR" : "NICHT EINREICHBAR"}
        </span>
      </td>
    </tr>
  </table>
</div>

<div class="page-break"></div>

<!-- Overall Score -->
<h2>Overall Compliance Score</h2>
<p>Gewichteter Composite-Score: Systems 25% / Conformity 20% / Incidents 15% / FRIA 15% / QMS 15% / GPAI 10%.</p>
<div class="headline-score">
  <span class="big">${report.overallComplianceScore}</span>
  <span class="suffix">/ 100</span>
  <span class="score-pill" style="margin-left:auto;background:${overall.bg};color:${overall.fg}">${overall.label}</span>
</div>
<div class="progress-bar"><div class="progress-bar-fill" style="width:${report.overallComplianceScore}%;background:${overall.fg}"></div></div>

<!-- Critical + Highlights -->
<div class="columns">
  <div class="column">
    <h3 style="color:#dc2626">Kritische Befunde (${report.criticalFindings.length})</h3>
    <ul>${criticalList}</ul>
  </div>
  <div class="column">
    <h3 style="color:#059669">Highlights (${report.highlights.length})</h3>
    <ul>${highlightList}</ul>
  </div>
</div>

<!-- Section Breakdown -->
<h2>Abschnitte im Detail</h2>
${sectionCards}

<div class="page-break"></div>

<!-- Raw Input -->
<h2>Zahlen-Drill-Down</h2>
<p>Rohdaten aus den Aggregations-Queries — zur Auditor-Nachvollziehbarkeit.</p>

<h3>AI-Systeme</h3>
<table>
  <thead><tr><th>Metrik</th><th style="text-align:right">Wert</th></tr></thead>
  <tbody>
    <tr><td>Total</td><td style="text-align:right">${input.systems.total}</td></tr>
    <tr><td>High-Risk</td><td style="text-align:right">${input.systems.byRisk.high}</td></tr>
    <tr class="text-red"><td>Unacceptable</td><td style="text-align:right">${input.systems.byRisk.unacceptable}</td></tr>
    <tr><td>Limited</td><td style="text-align:right">${input.systems.byRisk.limited}</td></tr>
    <tr><td>Minimal</td><td style="text-align:right">${input.systems.byRisk.minimal}</td></tr>
    <tr class="text-emerald"><td>Compliant</td><td style="text-align:right">${input.systems.compliant}</td></tr>
    <tr class="text-red"><td>Non-Compliant</td><td style="text-align:right">${input.systems.nonCompliant}</td></tr>
    <tr><td>In-Assessment</td><td style="text-align:right">${input.systems.inAssessment}</td></tr>
  </tbody>
</table>

<h3>Conformity Assessments</h3>
<table>
  <thead><tr><th>Metrik</th><th style="text-align:right">Wert</th></tr></thead>
  <tbody>
    <tr><td>Completed</td><td style="text-align:right">${input.conformityAssessments.completed}</td></tr>
    <tr class="text-emerald"><td>Passed</td><td style="text-align:right">${input.conformityAssessments.passed}</td></tr>
    <tr class="text-red"><td>Failed</td><td style="text-align:right">${input.conformityAssessments.failed}</td></tr>
    <tr><td>Pending</td><td style="text-align:right">${input.conformityAssessments.pending}</td></tr>
  </tbody>
</table>

<h3>Incidents (Art. 73)</h3>
<table>
  <thead><tr><th>Metrik</th><th style="text-align:right">Wert</th></tr></thead>
  <tbody>
    <tr><td>Gesamt gemeldet</td><td style="text-align:right">${input.incidents.totalReported}</td></tr>
    <tr><td>Serious</td><td style="text-align:right">${input.incidents.seriousIncidents}</td></tr>
    <tr class="text-red"><td>Ueberfaellige Notifications</td><td style="text-align:right">${input.incidents.overdueNotifications}</td></tr>
    <tr><td>Avg. Notify-Time (h)</td><td style="text-align:right">${input.incidents.averageTimeToNotifyHours ?? "-"}</td></tr>
  </tbody>
</table>

<h3>FRIA (Art. 27)</h3>
<table>
  <thead><tr><th>Metrik</th><th style="text-align:right">Wert</th></tr></thead>
  <tbody>
    <tr><td>Erforderlich</td><td style="text-align:right">${input.fria.required}</td></tr>
    <tr><td>Completed</td><td style="text-align:right">${input.fria.completed}</td></tr>
    <tr class="text-emerald"><td>Approved</td><td style="text-align:right">${input.fria.approved}</td></tr>
  </tbody>
</table>

<h3>QMS (Art. 17)</h3>
<table>
  <thead><tr><th>Metrik</th><th style="text-align:right">Wert</th></tr></thead>
  <tbody>
    <tr><td>Avg. Maturity</td><td style="text-align:right">${input.qms.avgMaturity}%</td></tr>
    <tr class="text-emerald"><td>CE-ready</td><td style="text-align:right">${input.qms.readyForCe}</td></tr>
    <tr class="text-amber"><td>Nicht CE-ready</td><td style="text-align:right">${input.qms.notReadyForCe}</td></tr>
  </tbody>
</table>

<h3>GPAI Models (Art. 51-55)</h3>
<table>
  <thead><tr><th>Metrik</th><th style="text-align:right">Wert</th></tr></thead>
  <tbody>
    <tr><td>Gesamt</td><td style="text-align:right">${input.gpai.total}</td></tr>
    <tr class="text-amber"><td>Systemic-Risk</td><td style="text-align:right">${input.gpai.systemic}</td></tr>
  </tbody>
</table>

<h3>Corrective Actions</h3>
<table>
  <thead><tr><th>Metrik</th><th style="text-align:right">Wert</th></tr></thead>
  <tbody>
    <tr><td>Offen</td><td style="text-align:right">${input.correctiveActions.open}</td></tr>
    <tr class="text-emerald"><td>Geschlossen</td><td style="text-align:right">${input.correctiveActions.closed}</td></tr>
    <tr class="text-red"><td>Ueberfaellig</td><td style="text-align:right">${input.correctiveActions.overdue}</td></tr>
  </tbody>
</table>

<div class="footer">Vertraulich &mdash; Erstellt mit ARCTOS GRC Platform &mdash; ${now}</div>

</body>
</html>`;
}

function keyLabel(key: string): string {
  const map: Record<string, string> = {
    systems: "AI Systems",
    conformity: "Conformity Assessments",
    incidents: "Post-Market Incidents",
    fria: "FRIA",
    qms: "Quality Management System",
    gpai: "GPAI Models",
  };
  return map[key] ?? key;
}

type RouteParams = { params: Promise<{ year: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  const { year: yearStr } = await params;
  const year = parseInt(yearStr, 10);
  if (isNaN(year) || year < 2000 || year > 3000) {
    return Response.json({ error: "Invalid year" }, { status: 400 });
  }

  const ctx = await withAuth("admin", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, "GET");
  if (moduleCheck) return moduleCheck;

  const [org] = await db
    .select({ id: organization.id, name: organization.name })
    .from(organization)
    .where(eq(organization.id, ctx.orgId));
  if (!org) {
    return Response.json({ error: "Organization not found" }, { status: 404 });
  }

  const startOfYear = new Date(Date.UTC(year, 0, 1));
  const endOfYear = new Date(Date.UTC(year + 1, 0, 1));

  // Re-run the same aggregation as the JSON endpoint.
  const [sysCounts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      unacceptable: sql<number>`count(*) filter (where ${aiSystem.riskClassification} = 'unacceptable')::int`,
      high: sql<number>`count(*) filter (where ${aiSystem.riskClassification} = 'high')::int`,
      limited: sql<number>`count(*) filter (where ${aiSystem.riskClassification} = 'limited')::int`,
      minimal: sql<number>`count(*) filter (where ${aiSystem.riskClassification} = 'minimal')::int`,
      compliant: sql<number>`count(*) filter (where ${aiSystem.status} = 'compliant')::int`,
      nonCompliant: sql<number>`count(*) filter (where ${aiSystem.status} = 'non_compliant')::int`,
      inAssessment: sql<number>`count(*) filter (where ${aiSystem.status} = 'under_review')::int`,
    })
    .from(aiSystem)
    .where(and(eq(aiSystem.orgId, ctx.orgId), isNull(aiSystem.deletedAt)));

  const [conformityCounts] = await db
    .select({
      completed: sql<number>`count(*) filter (where ${aiConformityAssessment.status} = 'completed')::int`,
      passed: sql<number>`count(*) filter (where ${aiConformityAssessment.overallResult} = 'pass')::int`,
      failed: sql<number>`count(*) filter (where ${aiConformityAssessment.overallResult} = 'fail')::int`,
      pending: sql<number>`count(*) filter (where ${aiConformityAssessment.overallResult} = 'pending' or ${aiConformityAssessment.overallResult} is null)::int`,
    })
    .from(aiConformityAssessment)
    .where(
      and(
        eq(aiConformityAssessment.orgId, ctx.orgId),
        gte(aiConformityAssessment.createdAt, startOfYear),
        lt(aiConformityAssessment.createdAt, endOfYear),
      ),
    );

  const [incidentCounts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      serious: sql<number>`count(*) filter (where ${aiIncident.isSerious} = true)::int`,
      overdue: sql<number>`count(*) filter (where ${aiIncident.authorityDeadline} < now() and ${aiIncident.authorityNotifiedAt} is null)::int`,
      avgNotifyHours: sql<number | null>`avg(extract(epoch from (${aiIncident.authorityNotifiedAt} - ${aiIncident.detectedAt}))/3600) filter (where ${aiIncident.authorityNotifiedAt} is not null)`,
    })
    .from(aiIncident)
    .where(
      and(
        eq(aiIncident.orgId, ctx.orgId),
        gte(aiIncident.detectedAt, startOfYear),
        lt(aiIncident.detectedAt, endOfYear),
      ),
    );

  const [friaCounts] = await db
    .select({
      required: sql<number>`count(*)::int`,
      completed: sql<number>`count(*) filter (where ${aiFria.status} in ('completed','approved'))::int`,
      approved: sql<number>`count(*) filter (where ${aiFria.status} = 'approved')::int`,
    })
    .from(aiFria)
    .where(eq(aiFria.orgId, ctx.orgId));

  const qmsRows = await db.select().from(aiProviderQms).where(eq(aiProviderQms.orgId, ctx.orgId));
  let totalMaturity = 0;
  let readyForCe = 0;
  for (const q of qmsRows) {
    const checklist: QmsProcedureChecklist = {
      riskManagementProcedure: q.riskManagementProcedure,
      dataGovernanceProcedure: q.dataGovernanceProcedure,
      technicalDocumentationProcedure: q.technicalDocumentationProcedure,
      recordKeepingProcedure: q.recordKeepingProcedure,
      transparencyProcedure: q.transparencyProcedure,
      humanOversightProcedure: q.humanOversightProcedure,
      accuracyRobustnessProcedure: q.accuracyRobustnessProcedure,
      cybersecurityProcedure: q.cybersecurityProcedure,
      incidentReportingProcedure: q.incidentReportingProcedure,
      thirdPartyManagementProcedure: q.thirdPartyManagementProcedure,
    };
    const r = assessQmsReadinessForCe(checklist);
    totalMaturity += r.maturityScore;
    if (r.readyForCe) readyForCe++;
  }
  const avgMaturity = qmsRows.length > 0 ? Math.round(totalMaturity / qmsRows.length) : 0;
  const notReadyForCe = qmsRows.length - readyForCe;

  const [gpaiCounts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      systemic: sql<number>`count(*) filter (where ${aiGpaiModel.modelType} = 'systemic')::int`,
    })
    .from(aiGpaiModel)
    .where(eq(aiGpaiModel.orgId, ctx.orgId));

  const [caCounts] = await db
    .select({
      open: sql<number>`count(*) filter (where ${aiCorrectiveAction.status} = 'open')::int`,
      closed: sql<number>`count(*) filter (where ${aiCorrectiveAction.status} = 'closed')::int`,
      overdue: sql<number>`count(*) filter (where ${aiCorrectiveAction.dueDate} < current_date and ${aiCorrectiveAction.status} != 'closed')::int`,
    })
    .from(aiCorrectiveAction)
    .where(eq(aiCorrectiveAction.orgId, ctx.orgId));

  const reportInput: AnnualReportInput = {
    year,
    systems: {
      total: sysCounts?.total ?? 0,
      byRisk: {
        unacceptable: sysCounts?.unacceptable ?? 0,
        high: sysCounts?.high ?? 0,
        limited: sysCounts?.limited ?? 0,
        minimal: sysCounts?.minimal ?? 0,
      },
      compliant: sysCounts?.compliant ?? 0,
      nonCompliant: sysCounts?.nonCompliant ?? 0,
      inAssessment: sysCounts?.inAssessment ?? 0,
    },
    conformityAssessments: {
      completed: conformityCounts?.completed ?? 0,
      passed: conformityCounts?.passed ?? 0,
      failed: conformityCounts?.failed ?? 0,
      pending: conformityCounts?.pending ?? 0,
    },
    incidents: {
      totalReported: incidentCounts?.total ?? 0,
      seriousIncidents: incidentCounts?.serious ?? 0,
      overdueNotifications: incidentCounts?.overdue ?? 0,
      averageTimeToNotifyHours: incidentCounts?.avgNotifyHours
        ? Math.round(Number(incidentCounts.avgNotifyHours))
        : null,
    },
    fria: {
      required: friaCounts?.required ?? 0,
      completed: friaCounts?.completed ?? 0,
      approved: friaCounts?.approved ?? 0,
    },
    qms: { avgMaturity, readyForCe, notReadyForCe },
    gpai: { total: gpaiCounts?.total ?? 0, systemic: gpaiCounts?.systemic ?? 0 },
    correctiveActions: {
      open: caCounts?.open ?? 0,
      closed: caCounts?.closed ?? 0,
      overdue: caCounts?.overdue ?? 0,
    },
  };

  const report = computeAnnualReport(reportInput);
  const html = buildAnnualReportHTML(year, org.name, report, reportInput);

  // Render PDF via Puppeteer with HTML fallback.
  try {
    const puppeteer = await import("puppeteer");
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "2cm", bottom: "2.5cm", left: "2cm", right: "2cm" },
    });
    await browser.close();

    const filename = `AI-Act-Annual-Report-${year}-${org.name.replace(/[^a-zA-Z0-9\-_]/g, "_")}.pdf`;
    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch {
    const filename = `AI-Act-Annual-Report-${year}-${org.name.replace(/[^a-zA-Z0-9\-_]/g, "_")}.html`;
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }
}
