// GET /api/v1/ai-act/incidents/[id]/overdue-check
//
// Sprint 5.6: Art. 73 Incident-Overdue-Status fuer existierendes aiIncident.

import { db, aiIncident } from "@grc/db";
import { requireModule } from "@grc/auth";
import {
  checkIncidentOverdue,
  classifyIncidentDeadline,
  type IncidentClassification,
  type IncidentStatus,
} from "@grc/shared";
import { and, eq } from "drizzle-orm";
import { withAuth } from "@/lib/api";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, "GET");
  if (moduleCheck) return moduleCheck;

  const [incident] = await db
    .select()
    .from(aiIncident)
    .where(and(eq(aiIncident.id, id), eq(aiIncident.orgId, ctx.orgId)));
  if (!incident) {
    return Response.json({ error: "Incident not found" }, { status: 404 });
  }

  // Deadline: entweder explicit in authorityDeadline, sonst neu berechnen
  let deadlineAt: Date;
  if (incident.authorityDeadline) {
    deadlineAt = new Date(incident.authorityDeadline);
  } else {
    const seriousCriteria = (incident.seriousCriteria ?? []) as string[];
    const classification: IncidentClassification = {
      resultedInDeath: seriousCriteria.includes("death"),
      resultedInSeriousHealthDamage: seriousCriteria.includes("serious_health_damage"),
      isWidespreadInfringement: seriousCriteria.includes("widespread"),
      violatesUnionLaw: seriousCriteria.includes("union_law_violation"),
      affectsCriticalInfrastructure: seriousCriteria.includes("critical_infrastructure"),
      affectedPersonsCount: incident.affectedPersonsCount ?? 0,
    };
    const classified = classifyIncidentDeadline(classification, new Date(incident.detectedAt));
    deadlineAt = classified.deadlineAt;
  }

  const status: IncidentStatus = {
    detectedAt: new Date(incident.detectedAt),
    authorityNotifiedAt: incident.authorityNotifiedAt
      ? new Date(incident.authorityNotifiedAt)
      : null,
    deadlineAt,
    isSerious: incident.isSerious ?? false,
  };

  const result = checkIncidentOverdue(status);

  return Response.json({
    data: {
      incidentId: id,
      aiSystemId: incident.aiSystemId,
      isSerious: status.isSerious,
      deadlineAtIso: status.deadlineAt.toISOString(),
      authorityNotifiedAtIso: status.authorityNotifiedAt?.toISOString() ?? null,
      isNotified: result.isNotified,
      isOverdue: result.isOverdue,
      hoursUntilDeadline: result.hoursUntilDeadline,
      hoursOverdue: result.hoursOverdue,
      escalationLevel: result.escalationLevel,
    },
  });
}
