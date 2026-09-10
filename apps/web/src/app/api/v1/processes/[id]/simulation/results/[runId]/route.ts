import { db, processSimulationResult } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/processes/:id/simulation/results/:runId
export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; runId: string }> },
) {
  const ctx = await withAuth("admin", "process_owner", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { runId } = await params;

  const [result] = await db
    .select()
    .from(processSimulationResult)
    .where(
      and(
        eq(processSimulationResult.id, runId),
        eq(processSimulationResult.orgId, ctx.orgId),
      ),
    );

  if (!result) {
    return Response.json({ error: "Result not found" }, { status: 404 });
  }

  return Response.json({ data: result });
});
