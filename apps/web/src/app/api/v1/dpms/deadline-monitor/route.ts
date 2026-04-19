// GET /api/v1/dpms/deadline-monitor
//
// Unified deadline view across DSRs (Art. 12(3) 30d/90d response) and data
// breaches (Art. 33 72h DPA notification). Mirrors the AI-Act incidents-monitor
// shape so the UI can share bucket classification.

import { db, dsr, dataBreach } from "@grc/db";
import { requireModule } from "@grc/auth";
import { and, eq, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";

type EscalationLevel = "none" | "approaching" | "overdue" | "critical_overdue";

function classify(
  deadlineAt: Date | null,
  closedAt: Date | null,
  now: Date,
): { level: EscalationLevel; hoursUntilDeadline: number | null; hoursOverdue: number | null; isClosed: boolean } {
  if (closedAt) {
    return { level: "none", hoursUntilDeadline: null, hoursOverdue: null, isClosed: true };
  }
  if (!deadlineAt) {
    return { level: "none", hoursUntilDeadline: null, hoursOverdue: null, isClosed: false };
  }
  const diffMs = deadlineAt.getTime() - now.getTime();
  const hoursDiff = diffMs / (1000 * 60 * 60);
  if (hoursDiff > 24) {
    return {
      level: "none",
      hoursUntilDeadline: Math.round(hoursDiff),
      hoursOverdue: null,
      isClosed: false,
    };
  }
  if (hoursDiff > 0) {
    return {
      level: "approaching",
      hoursUntilDeadline: Math.round(hoursDiff),
      hoursOverdue: null,
      isClosed: false,
    };
  }
  const overdue = Math.round(-hoursDiff);
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

  const now = new Date();

  // ─── DSRs ─────────────────────────────────────────────────
  const dsrRows = await db
    .select({
      id: dsr.id,
      requestType: dsr.requestType,
      status: dsr.status,
      subjectName: dsr.subjectName,
      receivedAt: dsr.receivedAt,
      deadline: dsr.deadline,
      closedAt: dsr.closedAt,
    })
    .from(dsr)
    .where(eq(dsr.orgId, ctx.orgId));

  const dsrEnriched = dsrRows.map((r) => {
    const deadline = r.deadline ? new Date(r.deadline) : null;
    const closed = r.closedAt ? new Date(r.closedAt) : null;
    const c = classify(deadline, closed, now);
    return {
      kind: "dsr" as const,
      id: r.id,
      title: `${r.requestType.toUpperCase()} — ${r.subjectName ?? "(kein Name)"}`,
      status: r.status,
      createdAtIso: new Date(r.receivedAt).toISOString(),
      deadlineIso: deadline?.toISOString() ?? null,
      closedAtIso: closed?.toISOString() ?? null,
      escalationLevel: c.level,
      hoursUntilDeadline: c.hoursUntilDeadline,
      hoursOverdue: c.hoursOverdue,
      isClosed: c.isClosed,
      linkPath: `/dpms/dsr/${r.id}`,
    };
  });

  // ─── Breaches ─────────────────────────────────────────────
  const breachRows = await db
    .select({
      id: dataBreach.id,
      title: dataBreach.title,
      severity: dataBreach.severity,
      status: dataBreach.status,
      detectedAt: dataBreach.detectedAt,
      dpaNotifiedAt: dataBreach.dpaNotifiedAt,
      isDpaNotificationRequired: dataBreach.isDpaNotificationRequired,
      closedAt: dataBreach.closedAt,
    })
    .from(dataBreach)
    .where(and(eq(dataBreach.orgId, ctx.orgId), isNull(dataBreach.deletedAt)));

  const breachEnriched = breachRows.map((r) => {
    // Art. 33: 72h after detection for DPA notification, if required and not yet notified
    const requiresNotification = r.isDpaNotificationRequired && !r.dpaNotifiedAt;
    const deadline = requiresNotification
      ? new Date(new Date(r.detectedAt).getTime() + 72 * 60 * 60 * 1000)
      : null;
    const closed = r.closedAt ? new Date(r.closedAt) : null;
    const effectiveClosed = r.dpaNotifiedAt ? new Date(r.dpaNotifiedAt) : closed;
    const c = classify(deadline, effectiveClosed, now);
    return {
      kind: "breach" as const,
      id: r.id,
      title: r.title,
      status: r.status,
      severity: r.severity,
      createdAtIso: new Date(r.detectedAt).toISOString(),
      deadlineIso: deadline?.toISOString() ?? null,
      closedAtIso: effectiveClosed?.toISOString() ?? null,
      escalationLevel: c.level,
      hoursUntilDeadline: c.hoursUntilDeadline,
      hoursOverdue: c.hoursOverdue,
      isClosed: c.isClosed,
      linkPath: `/dpms/breaches/${r.id}`,
    };
  });

  const combined = [...dsrEnriched, ...breachEnriched];

  const summary = {
    total: combined.length,
    criticalOverdue: combined.filter((e) => e.escalationLevel === "critical_overdue").length,
    overdue: combined.filter((e) => e.escalationLevel === "overdue").length,
    approaching: combined.filter((e) => e.escalationLevel === "approaching").length,
    ok: combined.filter((e) => e.escalationLevel === "none").length,
    byKind: {
      dsr: {
        total: dsrEnriched.length,
        overdue: dsrEnriched.filter(
          (e) => e.escalationLevel === "overdue" || e.escalationLevel === "critical_overdue",
        ).length,
      },
      breach: {
        total: breachEnriched.length,
        overdue: breachEnriched.filter(
          (e) => e.escalationLevel === "overdue" || e.escalationLevel === "critical_overdue",
        ).length,
      },
    },
  };

  return Response.json({
    data: { items: combined, summary },
  });
}
