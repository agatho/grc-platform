// GET /api/v1/isms/cap-monitor/pdf

import { db, ismsNonconformity, ismsCorrectiveAction, organization } from "@grc/db";
import { requireModule } from "@grc/auth";
import { and, eq, not, inArray } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { renderHtmlToPdfResponse, escHtml, STANDARD_PDF_CSS } from "@/lib/pdf";

const DAY_MS = 24 * 60 * 60 * 1000;

type EscalationLevel = "none" | "approaching" | "overdue" | "critical_overdue";

function classify(dueDate: Date | null, now: Date): {
  level: EscalationLevel;
  daysUntilDeadline: number | null;
  daysOverdue: number | null;
} {
  if (!dueDate) return { level: "none", daysUntilDeadline: null, daysOverdue: null };
  const diffDays = Math.round((dueDate.getTime() - now.getTime()) / DAY_MS);
  if (diffDays > 7) return { level: "none", daysUntilDeadline: diffDays, daysOverdue: null };
  if (diffDays >= 0)
    return { level: "approaching", daysUntilDeadline: diffDays, daysOverdue: null };
  const overdue = -diffDays;
  return {
    level: overdue > 30 ? "critical_overdue" : "overdue",
    daysUntilDeadline: 0,
    daysOverdue: overdue,
  };
}

export async function GET(_req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, "GET");
  if (moduleCheck) return moduleCheck;

  const [org] = await db
    .select({ name: organization.name })
    .from(organization)
    .where(eq(organization.id, ctx.orgId));

  const now = new Date();

  const ncRows = await db
    .select()
    .from(ismsNonconformity)
    .where(
      and(
        eq(ismsNonconformity.orgId, ctx.orgId),
        not(inArray(ismsNonconformity.status, ["closed"])),
      ),
    );

  const caRows = await db
    .select()
    .from(ismsCorrectiveAction)
    .where(eq(ismsCorrectiveAction.orgId, ctx.orgId));
  const caOpen = caRows.filter((r) => !r.completedAt && r.status !== "closed");

  const ncEnriched = ncRows.map((r) => ({
    r,
    c: classify(r.dueDate ? new Date(r.dueDate) : null, now),
  }));
  const caEnriched = caOpen.map((r) => ({
    r,
    c: classify(r.dueDate ? new Date(r.dueDate) : null, now),
  }));

  const summary = {
    ncTotal: ncEnriched.length,
    ncOverdue: ncEnriched.filter((e) => ["overdue", "critical_overdue"].includes(e.c.level)).length,
    ncCriticalOverdue: ncEnriched.filter((e) => e.c.level === "critical_overdue").length,
    caTotal: caEnriched.length,
    caOverdue: caEnriched.filter((e) => ["overdue", "critical_overdue"].includes(e.c.level)).length,
    caCriticalOverdue: caEnriched.filter((e) => e.c.level === "critical_overdue").length,
  };

  const sortFn = (a: { c: { level: EscalationLevel; daysOverdue: number | null } }, b: { c: { level: EscalationLevel; daysOverdue: number | null } }) => {
    const order: Record<string, number> = { critical_overdue: 0, overdue: 1, approaching: 2, none: 3 };
    const cmp = order[a.c.level] - order[b.c.level];
    if (cmp !== 0) return cmp;
    return (b.c.daysOverdue ?? 0) - (a.c.daysOverdue ?? 0);
  };
  ncEnriched.sort(sortFn);
  caEnriched.sort(sortFn);

  const exportTs = now.toLocaleString("de-DE");

  const ncHtml = ncEnriched.length
    ? ncEnriched
        .map(({ r, c }) => {
          const badge = `badge-${c.level.replace("_", "-")}`;
          const rest = c.daysOverdue
            ? `<span class="text-red">${c.daysOverdue}d ueberfaellig</span>`
            : c.daysUntilDeadline !== null
              ? `${c.daysUntilDeadline}d bis Frist`
              : "-";
          return `<tr>
          <td>${escHtml(r.ncCode ?? "")}</td>
          <td>${escHtml(r.title)}</td>
          <td>${escHtml(r.severity)}</td>
          <td>${escHtml(r.status)}</td>
          <td>${escHtml(r.isoClause ?? "-")}</td>
          <td>${r.dueDate ?? "-"}</td>
          <td><span class="badge ${badge}">${c.level.replace("_", " ").toUpperCase()}</span></td>
          <td>${rest}</td>
        </tr>`;
        })
        .join("")
    : "";

  const caHtml = caEnriched.length
    ? caEnriched
        .map(({ r, c }) => {
          const badge = `badge-${c.level.replace("_", "-")}`;
          const rest = c.daysOverdue
            ? `<span class="text-red">${c.daysOverdue}d ueberfaellig</span>`
            : c.daysUntilDeadline !== null
              ? `${c.daysUntilDeadline}d bis Frist`
              : "-";
          return `<tr>
          <td>${escHtml(r.title)}</td>
          <td>${escHtml(r.actionType)}</td>
          <td>${escHtml(r.status)}</td>
          <td>${r.dueDate ?? "-"}</td>
          <td><span class="badge ${badge}">${c.level.replace("_", " ").toUpperCase()}</span></td>
          <td>${rest}</td>
        </tr>`;
        })
        .join("")
    : "";

  const html = `<!DOCTYPE html>
<html lang="de"><head><meta charset="UTF-8"><style>${STANDARD_PDF_CSS}</style></head><body>
<div class="cover">
  <h1>ISMS CAP Monitor</h1>
  <div class="subtitle">ISO 27001 Kap. 10 Corrective-Action-Program — ${escHtml(org?.name ?? "")}</div>
  <div style="margin-top:20px;font-size:10pt;color:#6b7280">Exportiert am ${exportTs}</div>
</div>

<h2>Summary</h2>
<div class="kpi-grid">
  <div class="kpi-card ${summary.ncCriticalOverdue > 0 ? "red" : ""}"><div class="kpi-value">${summary.ncTotal}</div><div class="kpi-label">Offene Nonconformities (${summary.ncOverdue} ueberfaellig)</div></div>
  <div class="kpi-card ${summary.caCriticalOverdue > 0 ? "red" : ""}"><div class="kpi-value">${summary.caTotal}</div><div class="kpi-label">Offene Corrective-Actions (${summary.caOverdue} ueberfaellig)</div></div>
  <div class="kpi-card ${summary.ncCriticalOverdue + summary.caCriticalOverdue > 0 ? "red" : "green"}"><div class="kpi-value">${summary.ncCriticalOverdue + summary.caCriticalOverdue}</div><div class="kpi-label">Critical Overdue (> 30d)</div></div>
</div>

<h2>Nonconformities (${summary.ncTotal})</h2>
${ncHtml
  ? `<table>
  <thead><tr><th>Code</th><th>Titel</th><th>Severity</th><th>Status</th><th>ISO Clause</th><th>Faellig</th><th>Escalation</th><th>Rest</th></tr></thead>
  <tbody>${ncHtml}</tbody>
</table>`
  : `<div class="empty">Keine offenen Nonconformities.</div>`}

<h2>Corrective Actions (${summary.caTotal})</h2>
${caHtml
  ? `<table>
  <thead><tr><th>Titel</th><th>Typ</th><th>Status</th><th>Faellig</th><th>Escalation</th><th>Rest</th></tr></thead>
  <tbody>${caHtml}</tbody>
</table>`
  : `<div class="empty">Keine offenen Corrective-Actions.</div>`}

<div class="footer">Vertraulich — Erstellt mit ARCTOS GRC Platform — ${exportTs}</div>
</body></html>`;

  return renderHtmlToPdfResponse(
    html,
    `ISMS-CAP-Monitor-${now.toISOString().slice(0, 10)}`,
  );
}
