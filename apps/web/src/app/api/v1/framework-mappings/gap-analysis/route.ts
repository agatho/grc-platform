import { db, frameworkGapAnalysis, controlFrameworkCoverage } from "@grc/db";
import { triggerGapAnalysisSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, count, desc } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
import type { SQL } from "drizzle-orm";

export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = triggerGapAnalysisSchema.safeParse(await req.json());
  if (!body.success)
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );

  const coverageItems = await db
    .select()
    .from(controlFrameworkCoverage)
    .where(
      and(
        eq(controlFrameworkCoverage.orgId, ctx.orgId),
        eq(controlFrameworkCoverage.framework, body.data.framework),
      ),
    );

  const totalControls = coverageItems.length;
  const covered = coverageItems.filter(
    (c) => c.coverageStatus === "covered",
  ).length;
  const partial = coverageItems.filter(
    (c) => c.coverageStatus === "partially_covered",
  ).length;
  const notCovered = coverageItems.filter(
    (c) => c.coverageStatus === "not_covered",
  ).length;
  const notApplicable = coverageItems.filter(
    (c) => c.coverageStatus === "not_applicable",
  ).length;
  const applicableTotal = totalControls - notApplicable;
  const coveragePercentage =
    applicableTotal > 0
      ? Math.round(((covered + partial * 0.5) / applicableTotal) * 10000) / 100
      : 0;

  const gapDetails = coverageItems
    .filter(
      (c) =>
        c.coverageStatus === "not_covered" ||
        c.coverageStatus === "partially_covered",
    )
    .map((c) => ({
      controlId: c.frameworkControlId,
      controlTitle: c.frameworkControlId,
      status: c.coverageStatus,
      recommendation:
        c.coverageStatus === "not_covered"
          ? "Implement control"
          : "Strengthen existing control",
    }));

  const riskExposure =
    coveragePercentage >= 80
      ? "low"
      : coveragePercentage >= 60
        ? "medium"
        : coveragePercentage >= 40
          ? "high"
          : "critical";

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(frameworkGapAnalysis)
      .values({
        orgId: ctx.orgId,
        framework: body.data.framework,
        analysisDate: new Date(),
        totalControls,
        coveredControls: covered,
        partiallyCoveredControls: partial,
        notCoveredControls: notCovered,
        notApplicableControls: notApplicable,
        coveragePercentage: String(coveragePercentage),
        gapDetails,
        prioritizedActions: gapDetails.slice(0, 10).map((g) => ({
          action: g.recommendation,
          priority: g.status === "not_covered" ? "high" : "medium",
          effort: "medium",
          impact: "high",
        })),
        riskExposure,
        createdBy: ctx.userId,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}

export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;
  const { page, limit, offset, searchParams } = paginate(req);

  const conditions: SQL[] = [eq(frameworkGapAnalysis.orgId, ctx.orgId)];
  const framework = searchParams.get("framework");
  if (framework) conditions.push(eq(frameworkGapAnalysis.framework, framework));

  const where = and(...conditions);
  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(frameworkGapAnalysis)
      .where(where)
      .orderBy(desc(frameworkGapAnalysis.analysisDate))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(frameworkGapAnalysis).where(where),
  ]);
  return paginatedResponse(items, total, page, limit);
}
