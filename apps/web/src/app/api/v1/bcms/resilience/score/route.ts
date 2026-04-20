import { db, resilienceScoreSnapshot } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/bcms/resilience/score — Current resilience score + factors
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const [latest] = await db
    .select()
    .from(resilienceScoreSnapshot)
    .where(eq(resilienceScoreSnapshot.orgId, ctx.orgId))
    .orderBy(desc(resilienceScoreSnapshot.snapshotAt))
    .limit(1);

  if (!latest) {
    return Response.json({
      data: {
        overallScore: 0,
        biaCompleteness: 0,
        bcpCurrency: 0,
        exerciseCompletion: 0,
        recoverCapability: 0,
        communicationReadiness: 0,
        procedureCompleteness: 0,
        supplyChainResilience: 0,
        snapshotAt: null,
      },
    });
  }

  return Response.json({ data: latest });
}
