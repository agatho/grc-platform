// POST /api/v1/ai-act/systems/[id]/deployer-compliance
//
// Sprint 5.4: Art. 26 Deployer-Duty-Compliance-Check.

import { db, aiSystem } from "@grc/db";
import { requireModule } from "@grc/auth";
import {
  assessDeployerCompliance,
  type DeployerDutyContext,
} from "@grc/shared";
import { and, eq } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  implementsHumanOversight: z.boolean().default(false),
  followsProviderInstructions: z.boolean().default(false),
  monitorsInputDataQuality: z.boolean().default(false),
  hasMonitoringProcess: z.boolean().default(false),
  hasReportingChannelToProvider: z.boolean().default(false),
  informsAffectedPersons: z.boolean().default(false),
  dpiaCompletedIfRequired: z.boolean().default(false),
  retainsLogs: z.boolean().default(false),
  dpiaRequired: z.boolean().default(false),
});

export async function POST(req: Request, { params }: RouteParams) {
  const { id } = await params;
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

  const [system] = await db
    .select({
      id: aiSystem.id,
      riskClassification: aiSystem.riskClassification,
      providerOrDeployer: aiSystem.providerOrDeployer,
    })
    .from(aiSystem)
    .where(and(eq(aiSystem.id, id), eq(aiSystem.orgId, ctx.orgId)));
  if (!system) {
    return Response.json({ error: "AI system not found" }, { status: 404 });
  }

  if (system.providerOrDeployer === "provider") {
    return Response.json(
      {
        error: "System is provider-only -- Art. 26 deployer duties do not apply.",
        hint: "Use Art. 16 provider-compliance endpoint instead.",
      },
      { status: 422 },
    );
  }

  const input: DeployerDutyContext = parsed.data;
  const result = assessDeployerCompliance(input);

  return Response.json({
    data: {
      aiSystemId: id,
      riskClassification: system.riskClassification,
      providerOrDeployer: system.providerOrDeployer,
      compliancePercent: result.compliancePercent,
      isCompliant: result.isCompliant,
      gaps: result.gaps,
      criticalGaps: result.criticalGaps,
    },
  });
}
