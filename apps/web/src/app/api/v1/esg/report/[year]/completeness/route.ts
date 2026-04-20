import {
  db,
  esgMaterialityAssessment,
  esgMaterialityTopic,
  esrsDatapointDefinition,
  esrsMetric,
  esgMeasurement,
  esgAnnualReport,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, gte, lte, count, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/esg/report/[year]/completeness — ESRS completeness check
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

  const yearStart = `${reportingYear}-01-01`;
  const yearEnd = `${reportingYear}-12-31`;

  // 1. Check materiality assessment
  const [assessment] = await db
    .select()
    .from(esgMaterialityAssessment)
    .where(
      and(
        eq(esgMaterialityAssessment.orgId, ctx.orgId),
        eq(esgMaterialityAssessment.reportingYear, reportingYear),
      ),
    );

  const materialityComplete = assessment?.status === "completed";

  // 2. Get material topics
  let materialTopics: string[] = [];
  if (assessment) {
    const topics = await db
      .select({ esrsStandard: esgMaterialityTopic.esrsStandard })
      .from(esgMaterialityTopic)
      .where(
        and(
          eq(esgMaterialityTopic.assessmentId, assessment.id),
          eq(esgMaterialityTopic.isMaterial, true),
        ),
      );
    materialTopics = topics.map((t) => t.esrsStandard);
  }

  // 3. Count mandatory datapoints for material topics
  let totalMandatory = 0;
  let coveredDatapoints = 0;

  if (materialTopics.length > 0) {
    const [mandatoryCount] = await db
      .select({ value: count() })
      .from(esrsDatapointDefinition)
      .where(
        and(
          eq(esrsDatapointDefinition.isMandatory, true),
          sql`${esrsDatapointDefinition.esrsStandard} = ANY(${materialTopics})`,
        ),
      );
    totalMandatory = Number(mandatoryCount?.value ?? 0);

    // Count datapoints that have at least one measurement in the year
    const coveredResult = await db.execute(sql`
      SELECT COUNT(DISTINCT dp.id) as covered
      FROM esrs_datapoint_definition dp
      JOIN esrs_metric m ON m.datapoint_id = dp.id AND m.org_id = ${ctx.orgId}
      JOIN esg_measurement em ON em.metric_id = m.id AND em.org_id = ${ctx.orgId}
        AND em.period_start >= ${yearStart} AND em.period_end <= ${yearEnd}
      WHERE dp.is_mandatory = true
        AND dp.esrs_standard = ANY(${materialTopics})
    `);
    coveredDatapoints = Number((coveredResult as any)[0]?.covered ?? 0);
  }

  const completenessPercent =
    totalMandatory > 0
      ? Math.round((coveredDatapoints / totalMandatory) * 100)
      : 0;

  // 4. Update or create annual report record
  const [existingReport] = await db
    .select()
    .from(esgAnnualReport)
    .where(
      and(
        eq(esgAnnualReport.orgId, ctx.orgId),
        eq(esgAnnualReport.reportingYear, reportingYear),
      ),
    );

  if (existingReport) {
    await db
      .update(esgAnnualReport)
      .set({ completenessPercent })
      .where(eq(esgAnnualReport.id, existingReport.id));
  }

  return Response.json({
    data: {
      reportingYear,
      materialityComplete,
      materialTopics,
      totalMandatoryDatapoints: totalMandatory,
      coveredDatapoints,
      completenessPercent,
      missingDatapoints: totalMandatory - coveredDatapoints,
      report: existingReport ?? null,
    },
  });
}
