// GET /api/v1/dpms/deadline-monitor/pdf

import { db, dsr, dataBreach, organization } from "@grc/db";
import { requireModule } from "@grc/auth";
import { and, eq, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { renderHtmlToPdfResponse, escHtml, STANDARD_PDF_CSS } from "@/lib/pdf";

type EscalationLevel = "none" | "approaching" | "overdue" | "critical_overdue";

function classify(
  deadlineAt: Date | null,
  closedAt: Date | null,
  now: Date,
): {
  level: EscalationLevel;
  hoursUntilDeadline: number | null;
  hoursOverdue: number | null;
  isClosed: boolean;
} {
  if (closedAt)
    return {
      level: "none",
      hoursUntilDeadline: null,
      hoursOverdue: null,
      isClosed: true,
    };
  if (!deadlineAt)
    return {
      level: "none",
      hoursUntilDeadline: null,
      hoursOverdue: null,
      isClosed: false,
    };
  const h = (deadlineAt.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (h > 24)
    return {
      level: "none",
      hoursUntilDeadline: Math.round(h),
      hoursOverdue: null,
      isClosed: false,
    };
  if (h > 0)
    return {
      level: "approaching",
      hoursUntilDeadline: Math.round(h),
      hoursOverdue: null,
      isClosed: false,
    };
  const overdue = Math.round(-h);
  return {
    level: overdue > 48 ? "critical_overdue" : "overdue",
    hoursUntilDeadline: 0,
    hoursOverdue: overdue,
    isClosed: false,
  };
}

export async function GET(_req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dpms", ctx.orgId, "GET");
  if (moduleCheck) return moduleCheck;

  const [org] = await db
    .select({ name: organization.name })
    .from(organization)
    .where(eq(organization.id, ctx.orgId));

  const now = new Date();

  const dsrRows = await db.select().from(dsr).where(eq(dsr.orgId, ctx.orgId));
  const breachRows = await db
    .select()
    .from(dataBreach)
    .where(and(eq(dataBreach.orgId, ctx.orgId), isNull(dataBreach.deletedAt)));

  type Item = {
    kind: "dsr" | "breach";
    title: string;
    status: string;
    createdAt: Date;
    deadlineAt: Date | null;
    escalation: ReturnType<typeof classify>;
  };

  const items: Item[] = [
    ...dsrRows.map((r) => {
      const deadline = r.deadline ? new Date(r.deadline) : null;
      const closed = r.closedAt ? new Date(r.closedAt) : null;
      return {
        kind: "dsr" as const,
        title: `${r.requestType.toUpperCase()} — ${r.subjectName ?? "(kein Name)"}`,
        status: r.status,
        createdAt: new Date(r.receivedAt),
        deadlineAt: deadline,
        escalation: classify(deadline, closed, now),
      };
    }),
    ...breachRows.map((r) => {
      const requiresNotification =
        r.isDpaNotificationRequired && !r.dpaNotifiedAt;
      const deadline = requiresNotification
        ? new Date(new Date(r.detectedAt).getTime() + 72 * 60 * 60 * 1000)
        : null;
      const closed = r.dpaNotifiedAt
        ? new Date(r.dpaNotifiedAt)
        : r.closedAt
          ? new Date(r.closedAt)
          : null;
      return {
        kind: "breach" as const,
        title: r.title,
        status: r.status,
        createdAt: new Date(r.detectedAt),
        deadlineAt: deadline,
        escalation: classify(deadline, closed, now),
      };
    }),
  ];

  const summary = {
    total: items.length,
    criticalOverdue: items.filter(
      (i) => i.escalation.level === "critical_overdue",
    ).length,
    overdue: items.filter((i) => i.escalation.level === "overdue").length,
    approaching: items.filter((i) => i.escalation.level === "approaching")
      .length,
    ok: items.filter((i) => i.escalation.level === "none").length,
  };

  items.sort((a, b) => {
    const order: Record<string, number> = {
      critical_overdue: 0,
      overdue: 1,
      approaching: 2,
      none: 3,
    };
    const cmp = order[a.escalation.level] - order[b.escalation.level];
    if (cmp !== 0) return cmp;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  const rowsHtml = items.length
    ? items
        .map((i) => {
          const lvl = i.escalation.level;
          const badge = `badge-${lvl.replace("_", "-")}`;
          const rest = i.escalation.isClosed
            ? `<span class="text-emerald">geschlossen</span>`
            : i.escalation.hoursOverdue
              ? `<span class="text-red">${i.escalation.hoursOverdue}h ueberfaellig</span>`
              : i.escalation.hoursUntilDeadline !== null
                ? `${i.escalation.hoursUntilDeadline}h verbleibend`
                : "-";
          return `<tr>
            <td>${i.kind === "dsr" ? "DSR" : "Breach"}</td>
            <td>${escHtml(i.title)}</td>
            <td>${escHtml(i.status)}</td>
            <td>${i.createdAt.toLocaleString("de-DE")}</td>
            <td>${i.deadlineAt ? i.deadlineAt.toLocaleString("de-DE") : "-"}</td>
            <td><span class="badge ${badge}">${lvl.replace("_", " ").toUpperCase()}</span></td>
            <td>${rest}</td>
          </tr>`;
        })
        .join("")
    : "";

  const exportTs = now.toLocaleString("de-DE");

  const html = `<!DOCTYPE html>
<html lang="de"><head><meta charset="UTF-8"><style>${STANDARD_PDF_CSS}</style></head><body>
<div class="cover">
  <h1>DPMS Deadline Monitor</h1>
  <div class="subtitle">DSR Art. 12(3) + Breach Art. 33 72h — ${escHtml(org?.name ?? "")}</div>
  <div style="margin-top:20px;font-size:10pt;color:#6b7280">Exportiert am ${exportTs}</div>
</div>

<h2>Summary</h2>
<div class="kpi-grid">
  <div class="kpi-card ${summary.criticalOverdue > 0 ? "red" : ""}"><div class="kpi-value">${summary.criticalOverdue}</div><div class="kpi-label">Critical Overdue</div></div>
  <div class="kpi-card ${summary.overdue > 0 ? "red" : ""}"><div class="kpi-value">${summary.overdue}</div><div class="kpi-label">Overdue</div></div>
  <div class="kpi-card ${summary.approaching > 0 ? "amber" : ""}"><div class="kpi-value">${summary.approaching}</div><div class="kpi-label">Approaching</div></div>
  <div class="kpi-card green"><div class="kpi-value">${summary.ok}</div><div class="kpi-label">OK</div></div>
</div>

<h2>Items (${summary.total})</h2>
${
  rowsHtml
    ? `<table>
  <thead><tr><th>Typ</th><th>Titel</th><th>Status</th><th>Erfasst</th><th>Frist</th><th>Escalation</th><th>Rest</th></tr></thead>
  <tbody>${rowsHtml}</tbody>
</table>`
    : `<div class="empty">Keine DSRs oder Breaches vorhanden.</div>`
}

<div class="footer">Vertraulich — Erstellt mit ARCTOS GRC Platform — ${exportTs}</div>
</body></html>`;

  return renderHtmlToPdfResponse(
    html,
    `DPMS-Deadline-Monitor-${now.toISOString().slice(0, 10)}`,
  );
}
