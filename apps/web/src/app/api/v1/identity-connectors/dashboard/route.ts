import { db, identityTestResult, identityConnectorConfig } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/identity-connectors/dashboard
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const configs = await db
    .select()
    .from(identityConnectorConfig)
    .where(eq(identityConnectorConfig.orgId, ctx.orgId));

  const latestResults = await db
    .select()
    .from(identityTestResult)
    .where(eq(identityTestResult.orgId, ctx.orgId))
    .orderBy(desc(identityTestResult.executedAt))
    .limit(50);

  const mfaResults = latestResults.filter(
    (r) => r.testCategory === "mfa_enforcement",
  );
  const mfaComplianceRate =
    mfaResults.length > 0
      ? Math.round(
          mfaResults.reduce(
            (sum, r) => sum + Number(r.complianceRate ?? 0),
            0,
          ) / mfaResults.length,
        )
      : 0;

  const staleResults = latestResults.filter(
    (r) => r.testCategory === "stale_accounts",
  );
  const staleAccounts = staleResults.reduce(
    (sum, r) => sum + r.nonCompliantUsers,
    0,
  );

  return Response.json({
    data: {
      totalUsers: latestResults.length > 0 ? latestResults[0].totalUsers : 0,
      mfaComplianceRate,
      staleAccounts,
      privilegedAccounts: 0,
      pendingAccessReviews: 0,
      saasComplianceRate: 0,
    },
  });
}
