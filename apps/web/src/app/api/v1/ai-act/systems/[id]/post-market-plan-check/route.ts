// POST /api/v1/ai-act/systems/[id]/post-market-plan-check
//
// Sprint 5.5: Art. 72 Post-Market-Monitoring-Plan-Quality-Check.

import { db, aiSystem } from "@grc/db";
import { requireModule } from "@grc/auth";
import { assessPostMarketPlan, type PostMarketPlanQuality } from "@grc/shared";
import { and, eq } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { z } from "zod";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

type RouteParams = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  hasDataCollectionProcess: z.boolean().default(false),
  hasPerformanceMetricsTracking: z.boolean().default(false),
  hasDriftDetection: z.boolean().default(false),
  hasIncidentReportingChannel: z.boolean().default(false),
  hasCorrectiveActionProcess: z.boolean().default(false),
  hasProviderFeedbackLoop: z.boolean().default(false),
  reviewFrequencyDays: z.number().int().min(1).max(3650).default(365),
});

export const POST = withErrorHandler(async function POST(
  req: Request,
  { params }: RouteParams,
) {
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

  const plan: PostMarketPlanQuality = parsed.data;
  const result = assessPostMarketPlan(plan);

  return Response.json({
    data: {
      aiSystemId: id,
      riskClassification: system.riskClassification,
      completenessPercent: result.completenessPercent,
      isAdequate: result.isAdequate,
      missing: result.missing,
      warnings: result.warnings,
    },
  });
});
