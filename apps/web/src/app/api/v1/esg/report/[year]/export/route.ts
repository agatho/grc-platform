import {
  db,
  esgAnnualReport,
  esgMaterialityAssessment,
  esgMaterialityTopic,
  esrsMetric,
  esgMeasurement,
  esgTarget,
  esrsDatapointDefinition,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/esg/report/[year]/export — Generate JSON export
export async function POST(
  req: Request,
  { params }: { params: Promise<{ year: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
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

  // Gather all ESG data for the year

  // 1. Materiality assessment + topics
  const [assessment] = await db
    .select()
    .from(esgMaterialityAssessment)
    .where(
      and(
        eq(esgMaterialityAssessment.orgId, ctx.orgId),
        eq(esgMaterialityAssessment.reportingYear, reportingYear),
      ),
    );

  let topics: any[] = [];
  if (assessment) {
    topics = await db
      .select()
      .from(esgMaterialityTopic)
      .where(eq(esgMaterialityTopic.assessmentId, assessment.id));
  }

  // 2. Metrics
  const metrics = await db
    .select({
      id: esrsMetric.id,
      name: esrsMetric.name,
      unit: esrsMetric.unit,
      datapointCode: esrsDatapointDefinition.datapointCode,
      esrsStandard: esrsDatapointDefinition.esrsStandard,
      datapointNameEn: esrsDatapointDefinition.nameEn,
    })
    .from(esrsMetric)
    .leftJoin(
      esrsDatapointDefinition,
      eq(esrsMetric.datapointId, esrsDatapointDefinition.id),
    )
    .where(eq(esrsMetric.orgId, ctx.orgId));

  // 3. Measurements for the year
  const measurements = await db
    .select()
    .from(esgMeasurement)
    .where(
      and(
        eq(esgMeasurement.orgId, ctx.orgId),
        gte(esgMeasurement.periodStart, yearStart),
        lte(esgMeasurement.periodEnd, yearEnd),
      ),
    )
    .orderBy(esgMeasurement.periodStart);

  // 4. Targets
  const targets = await db
    .select()
    .from(esgTarget)
    .where(eq(esgTarget.orgId, ctx.orgId));

  // Update report record
  const report = await withAuditContext(ctx, async (tx) => {
    const [existing] = await tx
      .select()
      .from(esgAnnualReport)
      .where(
        and(
          eq(esgAnnualReport.orgId, ctx.orgId),
          eq(esgAnnualReport.reportingYear, reportingYear),
        ),
      );

    if (existing) {
      const [updated] = await tx
        .update(esgAnnualReport)
        .set({ exportedAt: new Date() })
        .where(eq(esgAnnualReport.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await tx
        .insert(esgAnnualReport)
        .values({
          orgId: ctx.orgId,
          reportingYear,
          status: "draft",
          exportedAt: new Date(),
        })
        .returning();
      return created;
    }
  });

  const exportData = {
    meta: {
      reportingYear,
      exportedAt: new Date().toISOString(),
      orgId: ctx.orgId,
      reportId: report.id,
    },
    materiality: {
      assessment: assessment ?? null,
      topics,
    },
    metrics,
    measurements,
    targets,
  };

  return Response.json({ data: exportData });
}
