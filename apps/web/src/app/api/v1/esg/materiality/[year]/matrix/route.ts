import {
  db,
  esgMaterialityAssessment,
  esgMaterialityTopic,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { computeMaterialityMatrix } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/esg/materiality/[year]/matrix — Matrix data for visualization
export async function GET(
  req: Request,
  { params }: { params: Promise<{ year: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("esg", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { year } = await params;
  const reportingYear = parseInt(year, 10);
  if (isNaN(reportingYear)) {
    return Response.json({ error: "Invalid year" }, { status: 400 });
  }

  const [assessment] = await db
    .select()
    .from(esgMaterialityAssessment)
    .where(
      and(
        eq(esgMaterialityAssessment.orgId, ctx.orgId),
        eq(esgMaterialityAssessment.reportingYear, reportingYear),
      ),
    );

  if (!assessment) {
    return Response.json(
      { error: "Assessment not found" },
      { status: 404 },
    );
  }

  const topics = await db
    .select()
    .from(esgMaterialityTopic)
    .where(eq(esgMaterialityTopic.assessmentId, assessment.id));

  const matrixInput = topics.map((t) => ({
    id: t.id,
    topicName: t.topicName,
    esrsStandard: t.esrsStandard,
    impactScore: parseFloat(String(t.impactScore ?? 0)),
    financialScore: parseFloat(String(t.financialScore ?? 0)),
    isMaterial: t.isMaterial,
  }));

  const matrix = computeMaterialityMatrix(matrixInput);

  const materialCount = matrix.filter((t) => t.isMaterial).length;

  return Response.json({
    data: {
      assessmentId: assessment.id,
      reportingYear: assessment.reportingYear,
      status: assessment.status,
      topics: matrix,
      summary: {
        totalTopics: matrix.length,
        materialTopics: materialCount,
        nonMaterialTopics: matrix.length - materialCount,
      },
    },
  });
}
