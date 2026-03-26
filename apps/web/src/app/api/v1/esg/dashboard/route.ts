import {
  db,
  esgMaterialityAssessment,
  esgMaterialityTopic,
  esrsMetric,
  esgMeasurement,
  esgTarget,
  esgAnnualReport,
  esrsDatapointDefinition,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, count, desc, sql, gte, lte } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/esg/dashboard — Dashboard KPIs
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("esg", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const reportingYear =
    parseInt(url.searchParams.get("year") ?? "", 10) ||
    new Date().getFullYear();

  const yearStart = `${reportingYear}-01-01`;
  const yearEnd = `${reportingYear}-12-31`;

  // 1. Materiality status
  const [assessment] = await db
    .select({
      status: esgMaterialityAssessment.status,
      reportingYear: esgMaterialityAssessment.reportingYear,
    })
    .from(esgMaterialityAssessment)
    .where(
      and(
        eq(esgMaterialityAssessment.orgId, ctx.orgId),
        eq(esgMaterialityAssessment.reportingYear, reportingYear),
      ),
    );

  // 2. Material topics count
  let materialTopicCount = 0;
  let totalTopicCount = 0;
  if (assessment) {
    const [asmtRow] = await db
      .select({ id: esgMaterialityAssessment.id })
      .from(esgMaterialityAssessment)
      .where(
        and(
          eq(esgMaterialityAssessment.orgId, ctx.orgId),
          eq(esgMaterialityAssessment.reportingYear, reportingYear),
        ),
      );

    if (asmtRow) {
      const [materialCount] = await db
        .select({ value: count() })
        .from(esgMaterialityTopic)
        .where(
          and(
            eq(esgMaterialityTopic.assessmentId, asmtRow.id),
            eq(esgMaterialityTopic.isMaterial, true),
          ),
        );
      materialTopicCount = Number(materialCount?.value ?? 0);

      const [totalCount] = await db
        .select({ value: count() })
        .from(esgMaterialityTopic)
        .where(eq(esgMaterialityTopic.assessmentId, asmtRow.id));
      totalTopicCount = Number(totalCount?.value ?? 0);
    }
  }

  // 3. Active metrics
  const [metricsCount] = await db
    .select({ value: count() })
    .from(esrsMetric)
    .where(
      and(eq(esrsMetric.orgId, ctx.orgId), eq(esrsMetric.isActive, true)),
    );

  // 4. Measurements this year
  const [measurementsCount] = await db
    .select({ value: count() })
    .from(esgMeasurement)
    .where(
      and(
        eq(esgMeasurement.orgId, ctx.orgId),
        gte(esgMeasurement.periodStart, yearStart),
        lte(esgMeasurement.periodEnd, yearEnd),
      ),
    );

  // 5. Verified measurements
  const [verifiedCount] = await db
    .select({ value: count() })
    .from(esgMeasurement)
    .where(
      and(
        eq(esgMeasurement.orgId, ctx.orgId),
        gte(esgMeasurement.periodStart, yearStart),
        lte(esgMeasurement.periodEnd, yearEnd),
        sql`${esgMeasurement.verifiedAt} IS NOT NULL`,
      ),
    );

  // 6. Targets summary
  const targetsByStatus = await db
    .select({
      status: esgTarget.status,
      value: count(),
    })
    .from(esgTarget)
    .where(eq(esgTarget.orgId, ctx.orgId))
    .groupBy(esgTarget.status);

  const targetSummary: Record<string, number> = {
    on_track: 0,
    at_risk: 0,
    off_track: 0,
    achieved: 0,
  };
  for (const row of targetsByStatus) {
    targetSummary[row.status] = Number(row.value);
  }
  const totalTargets = Object.values(targetSummary).reduce(
    (a, b) => a + b,
    0,
  );

  // 7. Annual report status
  const [report] = await db
    .select()
    .from(esgAnnualReport)
    .where(
      and(
        eq(esgAnnualReport.orgId, ctx.orgId),
        eq(esgAnnualReport.reportingYear, reportingYear),
      ),
    );

  return Response.json({
    data: {
      reportingYear,
      materiality: {
        status: assessment?.status ?? "not_started",
        materialTopics: materialTopicCount,
        totalTopics: totalTopicCount,
      },
      metrics: {
        active: Number(metricsCount?.value ?? 0),
      },
      measurements: {
        total: Number(measurementsCount?.value ?? 0),
        verified: Number(verifiedCount?.value ?? 0),
        verificationRate:
          Number(measurementsCount?.value ?? 0) > 0
            ? Math.round(
                (Number(verifiedCount?.value ?? 0) /
                  Number(measurementsCount?.value ?? 0)) *
                  100,
              )
            : 0,
      },
      targets: {
        total: totalTargets,
        ...targetSummary,
      },
      report: {
        status: report?.status ?? "not_started",
        completenessPercent: report?.completenessPercent ?? 0,
        exportedAt: report?.exportedAt ?? null,
      },
    },
  });
}
