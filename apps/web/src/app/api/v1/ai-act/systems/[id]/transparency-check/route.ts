// POST /api/v1/ai-act/systems/[id]/transparency-check
//
// Sprint 5.4: Art. 50 Transparency-Disclosure-Coverage-Check.

import { db, aiSystem } from "@grc/db";
import { requireModule } from "@grc/auth";
import {
  assessTransparencyCoverage,
  type TransparencyContext,
  type TransparencyObligationType,
} from "@grc/shared";
import { and, eq } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { z } from "zod";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

type RouteParams = { params: Promise<{ id: string }> };

const obligationSchema = z.enum([
  "ai_interaction_disclosure",
  "emotion_recognition_disclosure",
  "biometric_categorization_disclosure",
  "deepfake_marking",
  "ai_generated_content_marking",
]);

const bodySchema = z.object({
  applicableObligations: z.array(obligationSchema).default([]),
  implementedDisclosures: z.array(obligationSchema).default([]),
  disclosureMethod: z
    .enum(["pre_interaction", "during_interaction", "post_interaction"])
    .nullable()
    .default(null),
  userCanAcknowledge: z.boolean().default(false),
});

export const POST = withErrorHandler(async function POST(
  req: Request,
  { params }: RouteParams,
) {
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
    })
    .from(aiSystem)
    .where(and(eq(aiSystem.id, id), eq(aiSystem.orgId, ctx.orgId)));
  if (!system) {
    return Response.json({ error: "AI system not found" }, { status: 404 });
  }

  const input: TransparencyContext = {
    applicableObligations: parsed.data
      .applicableObligations as TransparencyObligationType[],
    implementedDisclosures: parsed.data
      .implementedDisclosures as TransparencyObligationType[],
    disclosureMethod: parsed.data.disclosureMethod,
    userCanAcknowledge: parsed.data.userCanAcknowledge,
  };
  const result = assessTransparencyCoverage(input);

  return Response.json({
    data: {
      aiSystemId: id,
      riskClassification: system.riskClassification,
      coveragePercent: result.coveragePercent,
      covered: result.covered,
      missing: result.missing,
      methodAppropriate: result.methodAppropriate,
      isCompliant: result.isCompliant,
    },
  });
});
