// POST /api/v1/ai-act/systems/[id]/select-procedure
//
// Sprint 5.5: Art. 43 Conformity-Procedure-Selection.
// Liefert Annex VI (self-assessment) oder Annex VII (notified body) basierend auf
// Annex-III-Kategorie + harmonised-standards-compliance.

import { db, aiSystem } from "@grc/db";
import { requireModule } from "@grc/auth";
import { selectConformityProcedure, type AnnexIIICategory } from "@grc/shared";
import { and, eq } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  annexIIICategory: z.enum([
    "biometric",
    "critical_infra",
    "education",
    "employment",
    "essential_services",
    "law_enforcement",
    "migration_border",
    "justice",
  ]),
  hasHarmonisedStandardCompliance: z.boolean().default(false),
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

  if (system.riskClassification !== "high") {
    return Response.json(
      {
        error: "Conformity-Assessment only for high-risk systems",
        riskClassification: system.riskClassification,
      },
      { status: 422 },
    );
  }

  const procedure = selectConformityProcedure(
    parsed.data.annexIIICategory as AnnexIIICategory,
    parsed.data.hasHarmonisedStandardCompliance,
  );

  const requiresNotifiedBody = procedure === "annex_vii";

  return Response.json({
    data: {
      aiSystemId: id,
      annexIIICategory: parsed.data.annexIIICategory,
      hasHarmonisedStandardCompliance:
        parsed.data.hasHarmonisedStandardCompliance,
      procedure,
      requiresNotifiedBody,
      reasoning: requiresNotifiedBody
        ? parsed.data.annexIIICategory === "biometric" ||
          parsed.data.annexIIICategory === "law_enforcement"
          ? "Kategorie erfordert always Annex VII (notified body)."
          : "Ohne harmonised-standards-compliance Annex VII erforderlich."
        : "Annex VI self-assessment zulaessig (harmonised-standards erfuellt).",
    },
  });
}
