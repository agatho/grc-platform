// POST /api/v1/ai-act/systems/[id]/annex-iv-check
//
// Sprint 5.3: Art. 11 + Annex IV Technical-Documentation-Completeness-Check.
// Prueft alle 9 Annex-IV-Sections auf Vollstaendigkeit (>= 200 chars).

import { db, aiSystem } from "@grc/db";
import { requireModule } from "@grc/auth";
import { assessAnnexIvCompleteness, type AnnexIvSections } from "@grc/shared";
import { and, eq } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  section1_GeneralDescription: z.string().max(50000).nullable().default(null),
  section2_DetailedElements: z.string().max(50000).nullable().default(null),
  section3_Monitoring: z.string().max(50000).nullable().default(null),
  section4_PerformanceMetrics: z.string().max(50000).nullable().default(null),
  section5_RiskManagement: z.string().max(50000).nullable().default(null),
  section6_LifecycleChanges: z.string().max(50000).nullable().default(null),
  section7_HarmonisedStandards: z.string().max(50000).nullable().default(null),
  section8_DeclarationOfConformity: z
    .string()
    .max(50000)
    .nullable()
    .default(null),
  section9_PostMarketMonitoring: z.string().max(50000).nullable().default(null),
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

  const sections: AnnexIvSections = parsed.data;
  const result = assessAnnexIvCompleteness(sections);

  return Response.json({
    data: {
      aiSystemId: id,
      riskClassification: system.riskClassification,
      sectionsCompleted: result.sectionsCompleted,
      totalSections: result.totalSections,
      missingSections: result.missingSections,
      coveragePercent: result.coveragePercent,
      averageSectionLengthChars: result.averageSectionLengthChars,
      readyForSubmission: result.readyForSubmission,
      warnings: result.readyForSubmission
        ? []
        : [
            `Noch ${result.missingSections.length} Section(s) unter 200 chars -- nicht einreichbar.`,
          ],
    },
  });
}
