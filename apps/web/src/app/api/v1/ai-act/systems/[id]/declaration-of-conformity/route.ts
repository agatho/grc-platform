// POST /api/v1/ai-act/systems/[id]/declaration-of-conformity
//
// Sprint 5.3: EU-Declaration-of-Conformity Validator (Art. 47 + Annex V).
// Prueft ob alle Pflichtfelder ausgefuellt sind bevor DoC abgegeben werden kann.

import { db, aiSystem } from "@grc/db";
import { requireModule } from "@grc/auth";
import {
  validateDeclarationOfConformity,
  type DeclarationOfConformityInput,
} from "@grc/shared";
import { and, eq } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  providerName: z.string().max(500).optional(),
  providerAddress: z.string().max(1000).optional(),
  aiSystemName: z.string().max(500).optional(),
  aiSystemVersion: z.string().max(100).optional(),
  intendedPurpose: z.string().max(5000).optional(),
  harmonisedStandards: z.array(z.string().min(1).max(200)).optional(),
  conformityAssessmentProcedure: z.enum(["annex_vi", "annex_vii"]).optional(),
  notifiedBodyId: z.string().max(100).nullable().optional(),
  notifiedBodyName: z.string().max(500).nullable().optional(),
  signatoryName: z.string().max(200).optional(),
  signatoryTitle: z.string().max(200).optional(),
  dateOfDeclaration: z.string().max(30).optional(),
  placeOfIssue: z.string().max(200).optional(),
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

  const input = parsed.data as Partial<DeclarationOfConformityInput>;
  const result = validateDeclarationOfConformity(input);

  return Response.json({
    data: {
      aiSystemId: id,
      riskClassification: system.riskClassification,
      valid: result.valid,
      missing: result.missing,
      readyToSign: result.valid,
    },
  });
}
