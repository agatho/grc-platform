// GET /api/v1/ai-act/incidents-monitor/pdf
//
// PDF variant of the AI-Act Incidents Monitor. Same aggregation logic as the
// JSON endpoint, but rendered into a printable audit trail.

import { db, aiIncident, organization } from "@grc/db";
import { requireModule } from "@grc/auth";
import {
  checkIncidentOverdue,
  classifyIncidentDeadline,
  type IncidentClassification,
  type AiActIncidentSnapshot,
} from "@grc/shared";
import { desc, eq } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { renderHtmlToPdfResponse, escHtml, STANDARD_PDF_CSS } from "@/lib/pdf";

export async function GET(_req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, "GET");
  if (moduleCheck) return moduleCheck;

  const [org] = await db
    .select({ name: organization.name })
    .from(organization)
    .where(eq(organization.id, ctx.orgId));

  const rows = await db
    .select()
    .from(aiIncident)
    .where(eq(aiIncident.orgId, ctx.orgId))
    .orderBy(desc(aiIncident.detectedAt));

  const enriched = rows.map((r) => {
    let deadlineAt: Date;
    if (r.authorityDeadline) {
      deadlineAt = new Date(r.authorityDeadline);
    } else {
      const criteria = (r.seriousCriteria ?? []) as string[];
      const classification: IncidentClassification = {
        resultedInDeath: criteria.includes("death"),
        resultedInSeriousHealthDamage: criteria.includes(
          "serious_health_damage",
        ),
        isWidespreadInfringement: criteria.includes("widespread"),
        violatesUnionLaw: criteria.includes("union_law_violation"),
        affectsCriticalInfrastructure: criteria.includes(
          "critical_infrastructure",
        ),
        affectedPersonsCount: r.affectedPersonsCount ?? 0,
      };
      deadlineAt = classifyIncidentDeadline(
        classification,
        new Date(r.detectedAt),
      ).deadlineAt;
    }

    const status: AiActIncidentSnapshot = {
      detectedAt: new Date(r.detectedAt),
      authorityNotifiedAt: r.authorityNotifiedAt
        ? new Date(r.authorityNotifiedAt)
        : null,
      deadlineAt,
      isSerious: r.isSerious ?? false,
    };
    return { row: r, deadlineAt, overdue: checkIncidentOverdue(status) };
  });

  const summary = {
    total: enriched.length,
    criticalOverdue: enriched.filter(
      (e) => e.overdue.escalationLevel === "critical_overdue",
    ).length,
    overdue: enriched.filter((e) => e.overdue.escalationLevel === "overdue")
      .length,
    approaching: enriched.filter(
      (e) => e.overdue.escalationLevel === "approaching",
    ).length,
    ok: enriched.filter((e) => e.overdue.escalationLevel === "none").length,
  };

  enriched.sort((a, b) => {
    const order: Record<string, number> = {
      critical_overdue: 0,
      overdue: 1,
      approaching: 2,
      none: 3,
    };
    const cmp =
      order[a.overdue.escalationLevel] - order[b.overdue.escalationLevel];
    if (cmp !== 0) return cmp;
    return a.row.detectedAt > b.row.detectedAt ? -1 : 1;
  });

  const now = new Date().toLocaleString("de-DE");
  const tableRows = enriched.length
    ? enriched
        .map((e) => {
          const lvl = e.overdue.escalationLevel;
          const badge = `badge-${lvl.replace("_", "-")}`;
          const dueLabel = e.overdue.isNotified
            ? `<span class="text-emerald">benachrichtigt</span>`
            : e.overdue.isOverdue
              ? `<span class="text-red">${e.overdue.hoursOverdue}h ueberfaellig</span>`
              : e.overdue.hoursUntilDeadline !== null
                ? `${e.overdue.hoursUntilDeadline}h verbleibend`
                : "-";
          return `<tr>
            <td>${escHtml(e.row.title)}</td>
            <td>${escHtml(e.row.severity)}${e.row.isSerious ? " / serious" : ""}</td>
            <td>${new Date(e.row.detectedAt).toLocaleString("de-DE")}</td>
            <td>${e.deadlineAt.toLocaleString("de-DE")}</td>
            <td><span class="badge ${badge}">${lvl.replace("_", " ").toUpperCase()}</span></td>
            <td>${dueLabel}</td>
          </tr>`;
        })
        .join("")
    : "";

  const html = `<!DOCTYPE html>
<html lang="de"><head><meta charset="UTF-8"><style>${STANDARD_PDF_CSS}</style></head><body>
<div class="cover">
  <h1>AI-Act Incidents Monitor</h1>
  <div class="subtitle">Art. 73 Frist-Ueberwachung — ${escHtml(org?.name ?? "")}</div>
  <div style="margin-top:20px;font-size:10pt;color:#6b7280">Exportiert am ${now}</div>
</div>

<h2>Summary</h2>
<div class="kpi-grid">
  <div class="kpi-card ${summary.criticalOverdue > 0 ? "red" : ""}"><div class="kpi-value">${summary.criticalOverdue}</div><div class="kpi-label">Critical Overdue</div></div>
  <div class="kpi-card ${summary.overdue > 0 ? "red" : ""}"><div class="kpi-value">${summary.overdue}</div><div class="kpi-label">Overdue</div></div>
  <div class="kpi-card ${summary.approaching > 0 ? "amber" : ""}"><div class="kpi-value">${summary.approaching}</div><div class="kpi-label">Approaching</div></div>
  <div class="kpi-card green"><div class="kpi-value">${summary.ok}</div><div class="kpi-label">OK</div></div>
</div>

<h2>Incidents (${summary.total})</h2>
${
  tableRows
    ? `<table>
  <thead><tr><th>Titel</th><th>Severity</th><th>Erkannt</th><th>Frist (Art. 73)</th><th>Status</th><th>Rest</th></tr></thead>
  <tbody>${tableRows}</tbody>
</table>`
    : `<div class="empty">Keine Incidents erfasst.</div>`
}

<div class="footer">Vertraulich — Erstellt mit ARCTOS GRC Platform — ${now}</div>
</body></html>`;

  return renderHtmlToPdfResponse(
    html,
    `AI-Act-Incidents-Monitor-${new Date().toISOString().slice(0, 10)}`,
  );
}
