import { db, cloudTestSuite, cloudComplianceSnapshot } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/cloud-connectors/dashboard
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const suites = await db
    .select()
    .from(cloudTestSuite)
    .where(eq(cloudTestSuite.orgId, ctx.orgId));

  const providers: Array<{
    provider: string;
    connectorCount: number;
    overallScore: number;
    trend: string;
    criticalFindings: number;
  }> = [];

  for (const provider of ["aws", "azure", "gcp"] as const) {
    const providerSuites = suites.filter((s) => s.provider === provider);
    if (providerSuites.length === 0) continue;

    const [latestSnapshot] = await db
      .select()
      .from(cloudComplianceSnapshot)
      .where(
        and(
          eq(cloudComplianceSnapshot.orgId, ctx.orgId),
          eq(cloudComplianceSnapshot.provider, provider),
        ),
      )
      .orderBy(desc(cloudComplianceSnapshot.snapshotDate))
      .limit(1);

    providers.push({
      provider,
      connectorCount: providerSuites.length,
      overallScore: latestSnapshot ? Number(latestSnapshot.overallScore) : 0,
      trend: latestSnapshot?.trendDirection ?? "stable",
      criticalFindings: latestSnapshot?.criticalFindings ?? 0,
    });
  }

  const totalTests = suites.reduce((sum, s) => sum + s.totalTests, 0);
  const totalPassing = suites.reduce((sum, s) => sum + s.passingTests, 0);
  const passRate =
    totalTests > 0 ? Math.round((totalPassing / totalTests) * 100) : 0;

  return Response.json({
    data: {
      providers,
      totalTests,
      passRate,
      lastScanDate: suites.reduce(
        (latest, s) => {
          if (!s.lastRunAt) return latest;
          return !latest || new Date(s.lastRunAt) > new Date(latest)
            ? String(s.lastRunAt)
            : latest;
        },
        null as string | null,
      ),
    },
  });
}
