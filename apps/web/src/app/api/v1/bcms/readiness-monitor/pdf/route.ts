// GET /api/v1/bcms/readiness-monitor/pdf

import { db, crisisScenario, bcp, bcExercise, organization } from "@grc/db";
import { requireModule } from "@grc/auth";
import { computeDoraDeadlines } from "@grc/shared";
import { and, eq, isNull, gte } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { renderHtmlToPdfResponse, escHtml, STANDARD_PDF_CSS } from "@/lib/pdf";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function GET(_req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, "GET");
  if (moduleCheck) return moduleCheck;

  const [org] = await db
    .select({ name: organization.name })
    .from(organization)
    .where(eq(organization.id, ctx.orgId));

  const now = new Date();
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const yearStartIso = yearStart.toISOString().slice(0, 10);

  const crises = await db.select().from(crisisScenario).where(eq(crisisScenario.orgId, ctx.orgId));

  const activeCrises = crises
    .filter((c) => c.status === "activated")
    .map((c) => {
      const classifiedAt = c.activatedAt ? new Date(c.activatedAt) : now;
      const dora = computeDoraDeadlines(classifiedAt, now);
      return { c, dora, classifiedAt };
    });

  const bcps = await db
    .select()
    .from(bcp)
    .where(and(eq(bcp.orgId, ctx.orgId), isNull(bcp.deletedAt)));

  const bcpIssues = bcps
    .filter((b) => b.status === "published" || b.status === "approved")
    .map((b) => {
      const nextReview = b.nextReviewDate ? new Date(b.nextReviewDate) : null;
      const reviewOverdueDays = nextReview
        ? Math.floor((now.getTime() - nextReview.getTime()) / DAY_MS)
        : null;
      const lastTested = b.lastTestedDate ? new Date(b.lastTestedDate) : null;
      const testAgeDays = lastTested
        ? Math.floor((now.getTime() - lastTested.getTime()) / DAY_MS)
        : null;
      const reviewOverdue = reviewOverdueDays !== null && reviewOverdueDays > 0;
      const untested = lastTested === null;
      const testStale = testAgeDays !== null && testAgeDays > 365;
      return {
        b,
        reviewOverdueDays,
        testAgeDays,
        reviewOverdue,
        untested,
        testStale,
        hasIssue: reviewOverdue || untested || testStale,
      };
    })
    .filter((x) => x.hasIssue);

  const exercisesYtd = await db
    .select({ id: bcExercise.id })
    .from(bcExercise)
    .where(
      and(
        eq(bcExercise.orgId, ctx.orgId),
        eq(bcExercise.status, "completed"),
        gte(bcExercise.actualDate, yearStartIso),
      ),
    );

  const exerciseIsoGap = exercisesYtd.length === 0;
  const overallReady = activeCrises.length === 0 && bcpIssues.length === 0 && !exerciseIsoGap;

  const exportTs = now.toLocaleString("de-DE");

  const crisesHtml = activeCrises.length
    ? activeCrises
        .map(({ c, dora }) => {
          const nextLabel =
            dora.nextDeadlineLabel === "none"
              ? "Alle Fristen ueberschritten"
              : dora.nextDeadlineLabel;
          return `<tr>
          <td>${escHtml(c.name)}</td>
          <td>${escHtml(c.severity)}</td>
          <td>${c.activatedAt ? new Date(c.activatedAt).toLocaleString("de-DE") : "-"}</td>
          <td class="${dora.earlyWarningOverdue ? "text-red" : ""}">${dora.earlyWarning.toLocaleString("de-DE")}</td>
          <td class="${dora.intermediateOverdue ? "text-red" : ""}">${dora.intermediate.toLocaleString("de-DE")}</td>
          <td class="${dora.finalOverdue ? "text-red" : ""}">${dora.final.toLocaleString("de-DE")}</td>
          <td>${nextLabel}</td>
        </tr>`;
        })
        .join("")
    : "";

  const bcpHtml = bcpIssues.length
    ? bcpIssues
        .map((x) => {
          const flags: string[] = [];
          if (x.reviewOverdue) flags.push(`Review ${x.reviewOverdueDays}d ueberfaellig`);
          if (x.untested) flags.push("nie getestet");
          if (x.testStale) flags.push(`Test ${x.testAgeDays}d alt`);
          return `<tr>
          <td>${escHtml(x.b.title)}</td>
          <td>${escHtml(x.b.status)}</td>
          <td>${x.b.nextReviewDate ?? "-"}</td>
          <td>${x.b.lastTestedDate ?? "-"}</td>
          <td class="text-red">${flags.join(" · ")}</td>
        </tr>`;
        })
        .join("")
    : "";

  const html = `<!DOCTYPE html>
<html lang="de"><head><meta charset="UTF-8"><style>${STANDARD_PDF_CSS}</style></head><body>
<div class="cover">
  <h1>BCMS Readiness Monitor</h1>
  <div class="subtitle">DORA 4h/72h/1-Monat + BCP-Freshness + ISO 22301 Kap. 8.5 — ${escHtml(org?.name ?? "")}</div>
  <div style="margin-top:20px;font-size:11pt">
    <span class="badge ${overallReady ? "badge-ok" : "badge-overdue"}">
      ${overallReady ? "READY" : "LUECKEN"}
    </span>
  </div>
  <div style="margin-top:16px;font-size:10pt;color:#6b7280">Exportiert am ${exportTs}</div>
</div>

<h2>Summary</h2>
<div class="kpi-grid">
  <div class="kpi-card ${activeCrises.length > 0 ? "red" : ""}"><div class="kpi-value">${activeCrises.length}</div><div class="kpi-label">Aktive Krisen</div></div>
  <div class="kpi-card ${bcpIssues.length > 0 ? "amber" : ""}"><div class="kpi-value">${bcpIssues.length}/${bcps.length}</div><div class="kpi-label">BCP-Luecken</div></div>
  <div class="kpi-card ${exerciseIsoGap ? "red" : "green"}"><div class="kpi-value">${exercisesYtd.length}</div><div class="kpi-label">Uebungen YTD</div></div>
</div>

<h2>Aktive Krisen</h2>
${crisesHtml
  ? `<table>
  <thead><tr><th>Szenario</th><th>Severity</th><th>Aktiviert</th><th>4h Early-Warning</th><th>72h Intermediate</th><th>1-Monat Final</th><th>Naechste Deadline</th></tr></thead>
  <tbody>${crisesHtml}</tbody>
</table>`
  : `<div class="empty">Keine aktiven Krisen.</div>`}

<h2>ISO 22301 Kap. 8.5 Exercise-Coverage</h2>
<p>
  ${exercisesYtd.length} abgeschlossene Uebung${exercisesYtd.length === 1 ? "" : "en"} im aktuellen Kalenderjahr.
  ${exerciseIsoGap ? '<span class="text-red">LUECKE — ISO 22301 Kap. 8.5 Verstoss.</span>' : '<span class="text-emerald">ERFUELLT.</span>'}
</p>

<h2>BCPs mit Freshness-Luecken</h2>
${bcpHtml
  ? `<table>
  <thead><tr><th>BCP</th><th>Status</th><th>Naechste Review</th><th>Letzter Test</th><th>Befunde</th></tr></thead>
  <tbody>${bcpHtml}</tbody>
</table>`
  : `<div class="empty">Alle BCPs aktuell.</div>`}

<div class="footer">Vertraulich — Erstellt mit ARCTOS GRC Platform — ${exportTs}</div>
</body></html>`;

  return renderHtmlToPdfResponse(
    html,
    `BCMS-Readiness-Monitor-${now.toISOString().slice(0, 10)}`,
  );
}
