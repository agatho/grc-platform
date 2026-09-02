import { db, auditRiskPrediction } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/erm/predictions/:riskId — Prediction for specific risk
export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ riskId: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { riskId } = await params;

  const [row] = await db
    .select()
    .from(auditRiskPrediction)
    .where(
      and(
        eq(auditRiskPrediction.riskId, riskId),
        eq(auditRiskPrediction.orgId, ctx.orgId),
      ),
    )
    .orderBy(desc(auditRiskPrediction.computedAt))
    .limit(1);

  if (!row) {
    return Response.json(
      { error: "No prediction found for this risk" },
      { status: 404 },
    );
  }

  return Response.json({ data: row });
});
