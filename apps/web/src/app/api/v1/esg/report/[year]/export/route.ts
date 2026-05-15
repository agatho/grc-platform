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
import { eq, and, gte, lte } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// /api/v1/esg/report/[year]/export — JSON export for the annual
// report.
//
// POST  — generate AND record the export (stamps `exportedAt` on the
//         annual_report row so the compliance log shows when the
//         data left the system).
// GET   — read-only preview (no exportedAt write).
//
// #WAVE11-EXPORT: GET added to close the 405 regression Cowork QA
// flagged. The body is identical; the only difference is whether the
// export-log gets a timestamp.

interface RouteCtx {
  params: Promise<{ year: string }>;
}

export async function POST(req: Request, routeCtx: RouteCtx) {
  return handleExport(req, routeCtx, /* recordExport */ true);
}

export async function GET(req: Request, routeCtx: RouteCtx) {
  return handleExport(req, routeCtx, /* recordExport */ false);
}

async function handleExport(
  req: Request,
  { params }: RouteCtx,
  recordExport: boolean,
) {
  const ctx = await withAuth("admin", "risk_manager", "esg_manager");
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

  let topics: Record<string, unknown>[] = [];
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

  // Annual-report row. Always need it for the meta.reportId; only POST
  // stamps exportedAt (the GET preview is non-mutating).
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
      if (!recordExport) return existing;
      const [updated] = await tx
        .update(esgAnnualReport)
        .set({ exportedAt: new Date() })
        .where(eq(esgAnnualReport.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await tx
      .insert(esgAnnualReport)
      .values({
        orgId: ctx.orgId,
        reportingYear,
        status: "draft",
        exportedAt: recordExport ? new Date() : null,
      })
      .returning();
    return created;
  });

  const exportData = {
    meta: {
      reportingYear,
      generatedAt: new Date().toISOString(),
      orgId: ctx.orgId,
      reportId: report.id,
      // Distinguishes a recorded export from a read-only preview so
      // downstream consumers (e.g. EUSPA / CSRD tooling) can tell
      // whether the file is the legally-binding artefact.
      kind: recordExport ? "recorded_export" : "preview",
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
