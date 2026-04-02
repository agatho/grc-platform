import { db, auditRiskPrediction } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/erm/predictions/:riskId — Prediction for specific risk
export async function GET(
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
}
