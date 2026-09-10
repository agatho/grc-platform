import { db, incidentCorrelation } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] `withErrorHandler` is what opens the
// `requestDbStorage.run(...)` frame that `withAuth` -> establishRequestScopedContext
// mutates with the org-pinned connection (apps/web/src/lib/api-wrapper.ts:113).
// Without it that helper falls back to `requestDbStorage.enterWith(...)`, which
// Next drops across the `await` in withAuth (api.ts:184-196), the handler's
// queries run on the context-less base pool, and RLS filters every row — the
// route answers 200 with an EMPTY list instead of the tenant's data.
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/isms/incidents/mitre-heatmap — ATT&CK technique heatmap
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const correlations = await db
    .select()
    .from(incidentCorrelation)
    .where(
      and(
        eq(incidentCorrelation.orgId, ctx.orgId),
        eq(incidentCorrelation.correlationType, "mitre"),
      ),
    );

  // Aggregate MITRE techniques across correlations
  const techniqueCount = new Map<string, number>();

  for (const corr of correlations) {
    const techniques = (corr.mitreAttackTechniques ?? []) as string[];
    for (const tech of techniques) {
      techniqueCount.set(tech, (techniqueCount.get(tech) ?? 0) + 1);
    }
  }

  const heatmap = Array.from(techniqueCount.entries())
    .map(([technique, count]) => ({ technique, count }))
    .sort((a, b) => b.count - a.count);

  return Response.json({ data: heatmap });
});
