// POST /api/v1/ai-act/incidents/classify-deadline
//
// Sprint 5.6: Art. 73 Incident-Deadline-Classification.
// Stateless -- liefert Notification-Deadline basierend auf Incident-Properties.

import { requireModule } from "@grc/auth";
import {
  classifyIncidentDeadline,
  type IncidentClassification,
} from "@grc/shared";
import { withAuth } from "@/lib/api";
import { z } from "zod";

const bodySchema = z.object({
  resultedInDeath: z.boolean().default(false),
  resultedInSeriousHealthDamage: z.boolean().default(false),
  isWidespreadInfringement: z.boolean().default(false),
  violatesUnionLaw: z.boolean().default(false),
  affectsCriticalInfrastructure: z.boolean().default(false),
  affectedPersonsCount: z.number().int().nonnegative().default(0),
  detectedAt: z.string().datetime(),
});

export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "dpo");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const input: IncidentClassification = {
    resultedInDeath: parsed.data.resultedInDeath,
    resultedInSeriousHealthDamage: parsed.data.resultedInSeriousHealthDamage,
    isWidespreadInfringement: parsed.data.isWidespreadInfringement,
    violatesUnionLaw: parsed.data.violatesUnionLaw,
    affectsCriticalInfrastructure: parsed.data.affectsCriticalInfrastructure,
    affectedPersonsCount: parsed.data.affectedPersonsCount,
  };
  const detectedAt = new Date(parsed.data.detectedAt);
  const result = classifyIncidentDeadline(input, detectedAt);

  return Response.json({
    data: {
      isSerious: result.isSerious,
      notificationDeadlineDays: result.notificationDeadlineDays,
      notificationDeadlineHours: result.notificationDeadlineHours,
      deadlineCategory: result.deadlineCategory,
      deadlineAtIso: result.deadlineAt.toISOString(),
      reasoning: result.reasoning,
    },
  });
}
