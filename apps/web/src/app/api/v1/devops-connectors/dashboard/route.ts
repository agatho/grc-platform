import { db, devopsTestResult } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const results = await db
    .select()
    .from(devopsTestResult)
    .where(eq(devopsTestResult.orgId, ctx.orgId))
    .orderBy(desc(devopsTestResult.executedAt))
    .limit(100);

  const repoResults = results.filter((r) => r.resourceType === "repository");
  const branchProtection = repoResults.filter(
    (r) => r.testCategory === "branch_protection",
  );
  const codeReview = repoResults.filter(
    (r) => r.testCategory === "code_review",
  );
  const secretScanning = repoResults.filter(
    (r) => r.testCategory === "secret_scanning",
  );

  return Response.json({
    data: {
      repositoriesMonitored: new Set(repoResults.map((r) => r.resourceName))
        .size,
      branchProtectionRate:
        branchProtection.length > 0
          ? Math.round(
              (branchProtection.filter((r) => r.status === "pass").length /
                branchProtection.length) *
                100,
            )
          : 0,
      codeReviewCoverage:
        codeReview.length > 0
          ? Math.round(
              (codeReview.filter((r) => r.status === "pass").length /
                codeReview.length) *
                100,
            )
          : 0,
      secretScanningEnabled: secretScanning.filter((r) => r.status === "pass")
        .length,
      endpointComplianceRate: 0,
      firewallRuleCompliance: 0,
      criticalFindings: results.filter(
        (r) => r.severity === "critical" && r.status === "fail",
      ).length,
    },
  });
});
