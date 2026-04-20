// POST /api/v1/ai-act/systems/[id]/logging-check
//
// Sprint 5.4: Art. 12 Auto-Logging-Capability-Check.

import { db, aiSystem } from "@grc/db";
import { requireModule } from "@grc/auth";
import {
  assessLoggingCapability,
  type LoggingCapabilityContext,
  type LogCategory,
} from "@grc/shared";
import { and, eq } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string }> };

const logCategorySchema = z.enum([
  "input_data",
  "output_decision",
  "user_interaction",
  "performance_metric",
  "incident",
  "model_version_change",
]);

const bodySchema = z.object({
  hasAutomaticLogging: z.boolean().default(false),
  loggedCategories: z.array(logCategorySchema).default([]),
  logRetentionDays: z.number().int().nonnegative().default(0),
  tamperEvidentStorage: z.boolean().default(false),
  logsExportable: z.boolean().default(false),
});

export async function POST(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const ctx = await withAuth("admin", "risk_manager");
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

  const [system] = await db
    .select({
      id: aiSystem.id,
      riskClassification: aiSystem.riskClassification,
    })
    .from(aiSystem)
    .where(and(eq(aiSystem.id, id), eq(aiSystem.orgId, ctx.orgId)));
  if (!system) {
    return Response.json({ error: "AI system not found" }, { status: 404 });
  }

  const input: LoggingCapabilityContext = {
    hasAutomaticLogging: parsed.data.hasAutomaticLogging,
    loggedCategories: parsed.data.loggedCategories as LogCategory[],
    logRetentionDays: parsed.data.logRetentionDays,
    tamperEvidentStorage: parsed.data.tamperEvidentStorage,
    logsExportable: parsed.data.logsExportable,
  };
  const result = assessLoggingCapability(input);

  return Response.json({
    data: {
      aiSystemId: id,
      riskClassification: system.riskClassification,
      coveragePercent: result.coveragePercent,
      missingCategories: result.missingCategories,
      meetsMinimumRequirement: result.meetsMinimumRequirement,
      issues: result.issues,
    },
  });
}
