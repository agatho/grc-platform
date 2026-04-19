// GET /api/v1/isms/cap-monitor
//
// ISMS Corrective-Action-Program Monitor. Aggregates:
// 1. Open nonconformities with due_date status
// 2. Open corrective actions with due_date status
// 3. CAPAs awaiting effectiveness review
// Mirrors the escalation-level scheme used by the AI-Act incidents monitor.

import { db, ismsNonconformity, ismsCorrectiveAction } from "@grc/db";
import { requireModule } from "@grc/auth";
import { and, eq, not, inArray } from "drizzle-orm";
import { withAuth } from "@/lib/api";

const DAY_MS = 24 * 60 * 60 * 1000;

type EscalationLevel = "none" | "approaching" | "overdue" | "critical_overdue";

function classifyByDueDate(
  dueDate: Date | null,
  now: Date,
): {
  level: EscalationLevel;
  daysUntilDeadline: number | null;
  daysOverdue: number | null;
} {
  if (!dueDate) {
    return { level: "none", daysUntilDeadline: null, daysOverdue: null };
  }
  const diffMs = dueDate.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / DAY_MS);
  if (diffDays > 7) {
    return { level: "none", daysUntilDeadline: diffDays, daysOverdue: null };
  }
  if (diffDays >= 0) {
    return { level: "approaching", daysUntilDeadline: diffDays, daysOverdue: null };
  }
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

  const now = new Date();

  // ─── Open Nonconformities ────────────────────────────────
  const ncRows = await db
    .select({
      id: ismsNonconformity.id,
      ncCode: ismsNonconformity.ncCode,
      title: ismsNonconformity.title,
      severity: ismsNonconformity.severity,
      status: ismsNonconformity.status,
      category: ismsNonconformity.category,
      isoClause: ismsNonconformity.isoClause,
      identifiedAt: ismsNonconformity.identifiedAt,
      dueDate: ismsNonconformity.dueDate,
      assignedTo: ismsNonconformity.assignedTo,
    })
    .from(ismsNonconformity)
    .where(
      and(
        eq(ismsNonconformity.orgId, ctx.orgId),
        not(inArray(ismsNonconformity.status, ["closed"])),
      ),
    );

  const ncEnriched = ncRows.map((r) => {
    const due = r.dueDate ? new Date(r.dueDate) : null;
    const c = classifyByDueDate(due, now);
    // ISO 27001 Kap. 10 ist der primaere Referenzrahmen. ISO-Clause-basiertes
    // Mapping auf NIS2 / DORA / GDPR, wenn ein bekannter Bereich getroffen ist.
    const frameworks: string[] = ["ISO 27001 Kap. 10"];
    const clause = r.isoClause?.toLowerCase() ?? "";
    if (clause.startsWith("a.5") || clause.startsWith("a.6")) {
      frameworks.push("NIS2 Art. 21");
    }
    if (clause.startsWith("a.8")) {
      frameworks.push("NIS2 Art. 21", "DORA Art. 9");
    }
    if (clause.startsWith("a.18")) {
      frameworks.push("GDPR Art. 32");
    }
    return {
      kind: "nonconformity" as const,
      id: r.id,
      code: r.ncCode,
      title: r.title,
      severity: r.severity,
      status: r.status,
      category: r.category,
      isoClause: r.isoClause,
      identifiedAtIso: new Date(r.identifiedAt).toISOString(),
      dueDate: r.dueDate,
      assignedTo: r.assignedTo,
      frameworks,
      escalationLevel: c.level,
      daysUntilDeadline: c.daysUntilDeadline,
      daysOverdue: c.daysOverdue,
      linkPath: `/isms/cap/nonconformities/${r.id}`,
    };
  });

  // ─── Open Corrective Actions ─────────────────────────────
  const caRows = await db
    .select({
      id: ismsCorrectiveAction.id,
      title: ismsCorrectiveAction.title,
      status: ismsCorrectiveAction.status,
      dueDate: ismsCorrectiveAction.dueDate,
      completedAt: ismsCorrectiveAction.completedAt,
      nonconformityId: ismsCorrectiveAction.nonconformityId,
      assignedTo: ismsCorrectiveAction.assignedTo,
      actionType: ismsCorrectiveAction.actionType,
      verificationResult: ismsCorrectiveAction.verificationResult,
      effectivenessReviewDate: ismsCorrectiveAction.effectivenessReviewDate,
      effectivenessRating: ismsCorrectiveAction.effectivenessRating,
    })
    .from(ismsCorrectiveAction)
    .where(eq(ismsCorrectiveAction.orgId, ctx.orgId));

  const caOpen = caRows.filter((r) => !r.completedAt && r.status !== "closed");
  const caEnriched = caOpen.map((r) => {
    const due = r.dueDate ? new Date(r.dueDate) : null;
    const c = classifyByDueDate(due, now);
    return {
      kind: "corrective_action" as const,
      id: r.id,
      title: r.title,
      status: r.status,
      actionType: r.actionType,
      dueDate: r.dueDate,
      assignedTo: r.assignedTo,
      nonconformityId: r.nonconformityId,
      frameworks: ["ISO 27001 Kap. 10"],
      escalationLevel: c.level,
      daysUntilDeadline: c.daysUntilDeadline,
      daysOverdue: c.daysOverdue,
      linkPath: `/isms/cap/corrective-actions/${r.id}`,
    };
  });

  // ─── Effectiveness Review Queue ──────────────────────────
  // CAPAs where completed_at set but effectiveness_rating still null and
  // effectiveness_review_date is in the past -> review overdue
  const effectivenessDue = caRows
    .filter(
      (r) =>
        r.completedAt !== null &&
        r.effectivenessRating === null &&
        r.effectivenessReviewDate !== null,
    )
    .map((r) => {
      const due = r.effectivenessReviewDate ? new Date(r.effectivenessReviewDate) : null;
      const c = classifyByDueDate(due, now);
      return {
        kind: "effectiveness_review" as const,
        id: r.id,
        title: r.title,
        reviewDueDate: r.effectivenessReviewDate,
        escalationLevel: c.level,
        daysUntilDeadline: c.daysUntilDeadline,
        daysOverdue: c.daysOverdue,
        linkPath: `/isms/cap/corrective-actions/${r.id}`,
      };
    });

  const summary = {
    ncTotal: ncEnriched.length,
    ncOverdue: ncEnriched.filter(
      (e) => e.escalationLevel === "overdue" || e.escalationLevel === "critical_overdue",
    ).length,
    ncCriticalOverdue: ncEnriched.filter((e) => e.escalationLevel === "critical_overdue").length,
    caTotal: caEnriched.length,
    caOverdue: caEnriched.filter(
      (e) => e.escalationLevel === "overdue" || e.escalationLevel === "critical_overdue",
    ).length,
    caCriticalOverdue: caEnriched.filter((e) => e.escalationLevel === "critical_overdue").length,
    effectivenessReviewsDue: effectivenessDue.filter(
      (e) => e.escalationLevel !== "none",
    ).length,
    effectivenessReviewsOverdue: effectivenessDue.filter(
      (e) => e.escalationLevel === "overdue" || e.escalationLevel === "critical_overdue",
    ).length,
  };

  return Response.json({
    data: {
      summary,
      nonconformities: ncEnriched.sort(
        (a, b) =>
          (a.daysUntilDeadline ?? 999) - (b.daysUntilDeadline ?? 999) ||
          (b.daysOverdue ?? 0) - (a.daysOverdue ?? 0),
      ),
      correctiveActions: caEnriched.sort(
        (a, b) =>
          (a.daysUntilDeadline ?? 999) - (b.daysUntilDeadline ?? 999) ||
          (b.daysOverdue ?? 0) - (a.daysOverdue ?? 0),
      ),
      effectivenessReviews: effectivenessDue,
    },
  });
}
