import { db, dpia, dpiaMeasure, organization, user } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { renderPDF } from "@grc/reporting";

function esc(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function riskColor(score: number | null): string {
  if (!score) return "#6b7280";
  if (score >= 20) return "#dc2626";
  if (score >= 12) return "#ea580c";
  if (score >= 6) return "#ca8a04";
  return "#16a34a";
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: "Entwurf", in_progress: "In Bearbeitung", completed: "Abgeschlossen",
    pending_dpo_review: "Warte auf DSB-Freigabe", approved: "Freigegeben", rejected: "Abgelehnt",
  };
  return map[status] ?? status;
}

function legalBasisLabel(basis: string | null): string {
  const map: Record<string, string> = {
    consent: "Einwilligung (Art. 6(1)(a))", contract: "Vertragserfuellung (Art. 6(1)(b))",
    legal_obligation: "Rechtliche Verpflichtung (Art. 6(1)(c))", vital_interest: "Lebenswichtige Interessen (Art. 6(1)(d))",
    public_interest: "Oeffentliches Interesse (Art. 6(1)(e))", legitimate_interest: "Berechtigtes Interesse (Art. 6(1)(f))",
  };
  return basis ? (map[basis] ?? basis) : "Nicht angegeben";
}

function buildDpiaHTML(
  data: Record<string, unknown>,
  risks: Record<string, unknown>[],
  measures: Record<string, unknown>[],
  orgName: string,
): string {
  const title = esc(data.title as string);
  const now = new Date().toLocaleDateString("de-DE", { year: "numeric", month: "long", day: "numeric" });

  const transferRows = Array.isArray(data.thirdCountryTransfers)
    ? (data.thirdCountryTransfers as Array<{ country: string; legalBasis: string; safeguards: string }>)
        .map(t => `<tr><td>${esc(t.country)}</td><td>${esc(t.legalBasis)}</td><td>${esc(t.safeguards)}</td></tr>`)
        .join("")
    : "";

  const riskRows = risks
    .map((r) => {
      const score = r.risk_score as number | null;
      const color = riskColor(score);
      return `<tr>
        <td>${esc(r.riskDescription as string)}</td>
        <td style="text-align:center">${r.numeric_likelihood ?? "-"}</td>
        <td style="text-align:center">${r.numeric_impact ?? "-"}</td>
        <td style="text-align:center;font-weight:bold;color:${color}">${score ?? "-"}</td>
        <td>${r.erm_risk_id ? "Ja" : "Nein"}</td>
      </tr>`;
    })
    .join("");

  const measureRows = measures
    .map((m) => {
      const linkedRisk = m.riskId
        ? risks.find((r) => r.id === m.riskId)
        : null;
      const riskLabel = linkedRisk
        ? esc((linkedRisk.riskDescription as string).substring(0, 60)) + "..."
        : "DSFA-weit";
      const cost = m.costOnetime ? `${Number(m.costOnetime).toLocaleString("de-DE")} ${m.costCurrency ?? "EUR"}` : "-";
      return `<tr>
        <td>${esc(m.measureDescription as string)}</td>
        <td>${riskLabel}</td>
        <td>${esc(m.implementationTimeline as string) || "-"}</td>
        <td style="text-align:right">${cost}</td>
      </tr>`;
    })
    .join("");

  const dataCategories = Array.isArray(data.dataCategories)
    ? (data.dataCategories as string[]).map(c => `<span class="tag">${esc(c)}</span>`).join(" ")
    : "<em>Nicht angegeben</em>";
  const subjectCategories = Array.isArray(data.dataSubjectCategories)
    ? (data.dataSubjectCategories as string[]).map(c => `<span class="tag">${esc(c)}</span>`).join(" ")
    : "<em>Nicht angegeben</em>";
  const recipientList = Array.isArray(data.recipients)
    ? (data.recipients as string[]).map(r => `<li>${esc(r)}</li>`).join("")
    : "<li><em>Nicht angegeben</em></li>";

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 2cm; }
  body { font-family: -apple-system, 'Segoe UI', Arial, sans-serif; font-size: 11pt; line-height: 1.6; color: #1a1a1a; }
  h1 { font-size: 22pt; color: #1e3a5f; margin-bottom: 4px; }
  h2 { font-size: 14pt; color: #1e3a5f; border-bottom: 2px solid #1e3a5f; padding-bottom: 4px; margin-top: 28px; }
  h3 { font-size: 12pt; color: #374151; margin-top: 16px; }
  .cover { text-align: center; padding: 60px 0 40px; }
  .cover h1 { font-size: 28pt; }
  .cover .subtitle { font-size: 14pt; color: #6b7280; margin-top: 8px; }
  .cover .meta { margin-top: 40px; font-size: 11pt; color: #6b7280; }
  .cover .meta td { padding: 4px 12px; }
  .status-badge { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: 600; font-size: 10pt; }
  .status-approved { background: #dcfce7; color: #166534; }
  .status-pending { background: #fef9c3; color: #854d0e; }
  .status-draft { background: #f3f4f6; color: #374151; }
  .status-rejected { background: #fee2e2; color: #991b1b; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 10pt; }
  th { background: #f1f5f9; color: #1e3a5f; text-align: left; padding: 8px; border: 1px solid #e2e8f0; }
  td { padding: 8px; border: 1px solid #e2e8f0; vertical-align: top; }
  tr:nth-child(even) { background: #f8fafc; }
  .tag { display: inline-block; background: #e0e7ff; color: #3730a3; padding: 2px 8px; border-radius: 12px; font-size: 9pt; margin: 2px; }
  .field-label { font-weight: 600; color: #374151; margin-bottom: 2px; }
  .field-value { margin-bottom: 12px; }
  .section-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 12px 0; }
  .page-break { page-break-before: always; }
  .footer { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-size: 8pt; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 4px; }
  .risk-high { color: #dc2626; font-weight: bold; }
  .risk-medium { color: #ca8a04; }
  .risk-low { color: #16a34a; }
  .opinion-box { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; margin: 12px 0; }
</style>
</head>
<body>

<!-- Cover Page -->
<div class="cover">
  <h1>Datenschutz-Folgenabsch&auml;tzung</h1>
  <div class="subtitle">gem&auml;&szlig; Art. 35 DSGVO</div>
  <h2 style="border:none;text-align:center;margin-top:32px">${title}</h2>
  <table style="margin:40px auto;width:auto;border:none">
    <tr><td style="border:none;text-align:right;font-weight:600">Organisation:</td><td style="border:none">${esc(orgName)}</td></tr>
    <tr><td style="border:none;text-align:right;font-weight:600">Status:</td><td style="border:none"><span class="status-badge status-${data.status === "approved" ? "approved" : data.status === "pending_dpo_review" ? "pending" : data.status === "rejected" ? "rejected" : "draft"}">${statusLabel(data.status as string)}</span></td></tr>
    <tr><td style="border:none;text-align:right;font-weight:600">Erstellt am:</td><td style="border:none">${data.createdAt ? new Date(data.createdAt as string).toLocaleDateString("de-DE") : "-"}</td></tr>
    <tr><td style="border:none;text-align:right;font-weight:600">Exportiert am:</td><td style="border:none">${now}</td></tr>
  </table>
</div>

<div class="page-break"></div>

<!-- Section 1: Systematic Description -->
<h2>1. Systematische Beschreibung der Verarbeitung</h2>
<div class="field-label">Systematische Beschreibung (Art. 35(7)(a))</div>
<div class="field-value">${esc(data.systematicDescription as string) || esc(data.processingDescription as string) || "<em>Nicht ausgefuellt</em>"}</div>

${data.processingDescription && data.systematicDescription ? `
<div class="field-label">Verarbeitungsbeschreibung</div>
<div class="field-value">${esc(data.processingDescription as string)}</div>
` : ""}

<!-- Section 2: Legal Basis -->
<h2>2. Rechtsgrundlage &amp; Notwendigkeit</h2>
<div class="field-label">Rechtsgrundlage</div>
<div class="field-value">${legalBasisLabel(data.legalBasis as string)}</div>

<div class="field-label">Notwendigkeit &amp; Verh&auml;ltnism&auml;&szlig;igkeit</div>
<div class="field-value">${esc(data.necessityAssessment as string) || "<em>Nicht ausgefuellt</em>"}</div>

<div class="field-label">DSB-Konsultation erforderlich</div>
<div class="field-value">${data.dpoConsultationRequired ? "Ja" : "Nein"}</div>

<!-- Section 3: Data Categories -->
<h2>3. Datenkategorien &amp; Betroffene</h2>
<div class="field-label">Datenkategorien</div>
<div class="field-value">${dataCategories}</div>

<div class="field-label">Betroffenenkategorien</div>
<div class="field-value">${subjectCategories}</div>

<div class="field-label">Empf&auml;nger</div>
<ul>${recipientList}</ul>

<!-- Section 4: Third Country Transfers -->
${transferRows ? `
<h2>4. Drittlandtransfers</h2>
<table>
  <thead><tr><th>Land</th><th>Rechtsgrundlage</th><th>Schutzma&szlig;nahmen</th></tr></thead>
  <tbody>${transferRows}</tbody>
</table>
` : `<h2>4. Drittlandtransfers</h2><p><em>Keine Drittlandtransfers</em></p>`}

<!-- Section 5: Retention -->
<h2>5. Aufbewahrungsfrist</h2>
<div class="field-value">${esc(data.retentionPeriod as string) || "<em>Nicht angegeben</em>"}</div>

<div class="page-break"></div>

<!-- Section 6: Risk Analysis -->
<h2>6. Risikoanalyse</h2>
<p>${risks.length} identifizierte Risiken</p>
<table>
  <thead><tr><th style="width:45%">Risikobeschreibung</th><th style="width:12%;text-align:center">Wahrscheinlichkeit</th><th style="width:12%;text-align:center">Auswirkung</th><th style="width:12%;text-align:center">Risikoscore</th><th style="width:10%">Im ERM</th></tr></thead>
  <tbody>${riskRows || "<tr><td colspan='5'><em>Keine Risiken erfasst</em></td></tr>"}</tbody>
</table>

<!-- Section 7: Measures -->
<h2>7. Ma&szlig;nahmenplan</h2>
<p>${measures.length} Abhilfema&szlig;nahmen</p>
<table>
  <thead><tr><th style="width:40%">Ma&szlig;nahme</th><th style="width:25%">Verknuepftes Risiko</th><th style="width:15%">Zeitplan</th><th style="width:20%;text-align:right">Einmalkosten</th></tr></thead>
  <tbody>${measureRows || "<tr><td colspan='4'><em>Keine Massnahmen erfasst</em></td></tr>"}</tbody>
</table>

<div class="page-break"></div>

<!-- Section 8: DPO Consultation -->
<h2>8. DSB-Stellungnahme</h2>
${data.dpoOpinion ? `
<div class="opinion-box">
  <div class="field-label">Stellungnahme des Datenschutzbeauftragten</div>
  <div>${esc(data.dpoOpinion as string)}</div>
</div>
` : `<p><em>Noch keine Stellungnahme abgegeben</em></p>`}

${data.consultationResult ? `
<div class="field-label">Konsultationsergebnis</div>
<div class="field-value">${esc(data.consultationResult as string)}</div>
` : ""}

${data.consultationDate ? `
<div class="field-label">Konsultationsdatum</div>
<div class="field-value">${new Date(data.consultationDate as string).toLocaleDateString("de-DE")}</div>
` : ""}

<!-- Section 9: Sign-Off -->
<h2>9. Freigabe</h2>
<div class="section-box">
${data.signOffName ? `
  <div class="field-label">Freigegeben durch</div>
  <div class="field-value">${esc(data.signOffName as string)}</div>
  <div class="field-label">Status</div>
  <div class="field-value"><span class="status-badge status-approved">${statusLabel(data.status as string)}</span></div>
` : `
  <div class="field-value"><em>Ausstehend — DSFA wurde noch nicht freigegeben</em></div>
  <div class="field-label">Aktueller Status</div>
  <div class="field-value"><span class="status-badge status-${data.status === "rejected" ? "rejected" : "pending"}">${statusLabel(data.status as string)}</span></div>
`}
</div>

${data.nextReviewDate ? `
<div class="field-label">N&auml;chster Pruefungstermin</div>
<div class="field-value">${new Date(data.nextReviewDate as string).toLocaleDateString("de-DE")}</div>
` : ""}

<div class="footer">Vertraulich &mdash; Erstellt mit ARCTOS GRC Platform &mdash; ${now}</div>

</body>
</html>`;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "dpo");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("dpms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  // Fetch DPIA with all fields
  const [row] = await db
    .select({
      id: dpia.id, title: dpia.title, processingDescription: dpia.processingDescription,
      legalBasis: dpia.legalBasis, necessityAssessment: dpia.necessityAssessment,
      dpoConsultationRequired: dpia.dpoConsultationRequired,
      systematicDescription: dpia.systematicDescription, dataCategories: dpia.dataCategories,
      dataSubjectCategories: dpia.dataSubjectCategories, recipients: dpia.recipients,
      thirdCountryTransfers: dpia.thirdCountryTransfers, retentionPeriod: dpia.retentionPeriod,
      consultationResult: dpia.consultationResult, consultationDate: dpia.consultationDate,
      nextReviewDate: dpia.nextReviewDate, dpoOpinion: dpia.dpoOpinion,
      status: dpia.status, residualRiskSignOffId: dpia.residualRiskSignOffId,
      signOffName: user.name, createdAt: dpia.createdAt,
    })
    .from(dpia)
    .leftJoin(user, eq(dpia.residualRiskSignOffId, user.id))
    .where(and(eq(dpia.id, id), eq(dpia.orgId, ctx.orgId), isNull(dpia.deletedAt)));

  if (!row) return Response.json({ error: "Not found" }, { status: 404 });

  // Fetch org name
  const [org] = await db.select({ name: organization.name }).from(organization).where(eq(organization.id, ctx.orgId));

  // Fetch risks with numeric scores
  const risksResult = await db.execute(sql`
    SELECT id, risk_description AS "riskDescription",
           severity, likelihood, impact,
           numeric_likelihood, numeric_impact, risk_score,
           erm_risk_id
    FROM dpia_risk
    WHERE dpia_id = ${id}::uuid AND org_id = ${ctx.orgId}
    ORDER BY created_at
  `);

  // Fetch measures with risk linkage
  const measures = await db
    .select({
      id: dpiaMeasure.id, measureDescription: dpiaMeasure.measureDescription,
      riskId: dpiaMeasure.riskId, implementationTimeline: dpiaMeasure.implementationTimeline,
      costOnetime: dpiaMeasure.costOnetime, costCurrency: dpiaMeasure.costCurrency,
    })
    .from(dpiaMeasure)
    .where(and(eq(dpiaMeasure.dpiaId, id), eq(dpiaMeasure.orgId, ctx.orgId)));

  const html = buildDpiaHTML(
    row as unknown as Record<string, unknown>,
    (risksResult.rows ?? []) as Record<string, unknown>[],
    measures as unknown as Record<string, unknown>[],
    org?.name ?? "Organisation",
  );

  // Render PDF via Puppeteer
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

    const filename = `DSFA-${(row.title ?? "Export").replace(/[^a-zA-Z0-9\-_]/g, "_")}.pdf`;
    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch {
    // Puppeteer not available — return HTML as fallback
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="DSFA-${(row.title ?? "Export").replace(/[^a-zA-Z0-9\-_]/g, "_")}.html"`,
      },
    });
  }
}
