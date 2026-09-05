import { db, resilienceScoreSnapshot } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] `withErrorHandler` is what opens the
// `requestDbStorage.run(...)` frame that `withAuth` -> establishRequestScopedContext
// mutates with the org-pinned connection (apps/web/src/lib/api-wrapper.ts:113).
// Without it that helper falls back to `requestDbStorage.enterWith(...)`, which
// Next drops across the `await` in withAuth (api.ts:184-196), the handler's
// queries run on the context-less base pool, and RLS filters every row — the
// route answers 200 with an EMPTY list instead of the tenant's data.
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/bcms/resilience/score — Current resilience score + factors
export const GET = withErrorHandler(async function GET(req: Request) {
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
});
