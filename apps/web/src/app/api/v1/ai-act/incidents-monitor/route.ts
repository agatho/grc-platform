// GET /api/v1/ai-act/incidents-monitor
//
// Epic 5.6 complement: returns all AI-Act incidents for the org with inline
// overdue-status + escalation-level computed server-side. Saves N round-trips
// vs. calling /overdue-check per row from the UI.

import { db, aiIncident } from "@grc/db";
import { requireModule } from "@grc/auth";
import {
  checkIncidentOverdue,
  classifyIncidentDeadline,
  type IncidentClassification,
  type IncidentStatus,
} from "@grc/shared";
import { eq, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";

export async function GET(_req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, "GET");
  if (moduleCheck) return moduleCheck;

  const rows = await db
    .select({
      id: aiIncident.id,
      aiSystemId: aiIncident.aiSystemId,
      title: aiIncident.title,
      severity: aiIncident.severity,
      isSerious: aiIncident.isSerious,
      seriousCriteria: aiIncident.seriousCriteria,
      status: aiIncident.status,
      detectedAt: aiIncident.detectedAt,
      authorityDeadline: aiIncident.authorityDeadline,
      authorityNotifiedAt: aiIncident.authorityNotifiedAt,
      affectedPersonsCount: aiIncident.affectedPersonsCount,
    })
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
        resultedInSeriousHealthDamage: criteria.includes("serious_health_damage"),
        isWidespreadInfringement: criteria.includes("widespread"),
        violatesUnionLaw: criteria.includes("union_law_violation"),
        affectsCriticalInfrastructure: criteria.includes("critical_infrastructure"),
        affectedPersonsCount: r.affectedPersonsCount ?? 0,
      };
      deadlineAt = classifyIncidentDeadline(classification, new Date(r.detectedAt)).deadlineAt;
    }

    const status: IncidentStatus = {
      detectedAt: new Date(r.detectedAt),
      authorityNotifiedAt: r.authorityNotifiedAt ? new Date(r.authorityNotifiedAt) : null,
      deadlineAt,
      isSerious: r.isSerious ?? false,
    };

    const overdue = checkIncidentOverdue(status);

    return {
      id: r.id,
      aiSystemId: r.aiSystemId,
      title: r.title,
      severity: r.severity,
      isSerious: r.isSerious,
      status: r.status,
      detectedAt: new Date(r.detectedAt).toISOString(),
      deadlineAt: deadlineAt.toISOString(),
      authorityNotifiedAt: r.authorityNotifiedAt
        ? new Date(r.authorityNotifiedAt).toISOString()
        : null,
      overdue: {
        isNotified: overdue.isNotified,
        isOverdue: overdue.isOverdue,
        hoursUntilDeadline: overdue.hoursUntilDeadline,
        hoursOverdue: overdue.hoursOverdue,
        escalationLevel: overdue.escalationLevel,
      },
    };
  });

  const summary = {
    total: enriched.length,
    criticalOverdue: enriched.filter((e) => e.overdue.escalationLevel === "critical_overdue").length,
    overdue: enriched.filter((e) => e.overdue.escalationLevel === "overdue").length,
    approaching: enriched.filter((e) => e.overdue.escalationLevel === "approaching").length,
    ok: enriched.filter((e) => e.overdue.escalationLevel === "none").length,
  };

  return Response.json({
    data: { incidents: enriched, summary },
  });
}
