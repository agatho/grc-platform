import { db, simulationRun, simulationRunResult } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const { id } = await params;

  const [run] = await db
    .select()
    .from(simulationRun)
    .where(and(eq(simulationRun.id, id), eq(simulationRun.orgId, ctx.orgId)));
  if (!run) return Response.json({ error: "Not found" }, { status: 404 });

  const results = await db
    .select()
    .from(simulationRunResult)
    .where(eq(simulationRunResult.runId, id));

  return Response.json({ data: { ...run, results } });
});
