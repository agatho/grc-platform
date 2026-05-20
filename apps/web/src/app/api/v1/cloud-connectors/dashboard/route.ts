import { db, cloudTestSuite, cloudComplianceSnapshot } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, desc, inArray } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/cloud-connectors/dashboard
//
// F#14 (overnight 2026-05-18): used to issue 1 + 3 queries — one to load
// suites, then one per provider (aws/azure/gcp) to find the latest
// snapshot. Now a single SELECT DISTINCT ON pulls the latest snapshot
// row per provider in one round-trip.
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const PROVIDERS = ["aws", "azure", "gcp"] as const;

  const [suites, latestPerProvider] = await Promise.all([
    db.select().from(cloudTestSuite).where(eq(cloudTestSuite.orgId, ctx.orgId)),
    db
      .selectDistinctOn([cloudComplianceSnapshot.provider])
      .from(cloudComplianceSnapshot)
      .where(
        and(
          eq(cloudComplianceSnapshot.orgId, ctx.orgId),
          inArray(cloudComplianceSnapshot.provider, [...PROVIDERS]),
        ),
      )
      .orderBy(
        cloudComplianceSnapshot.provider,
        desc(cloudComplianceSnapshot.snapshotDate),
      ),
  ]);

  const snapshotByProvider = new Map(
    latestPerProvider.map((s) => [s.provider, s]),
  );

  const providers: Array<{
    provider: string;
    connectorCount: number;
    overallScore: number;
    trend: string;
    criticalFindings: number;
  }> = [];

  for (const provider of PROVIDERS) {
    const providerSuites = suites.filter((s) => s.provider === provider);
    if (providerSuites.length === 0) continue;
    const latestSnapshot = snapshotByProvider.get(provider);

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
