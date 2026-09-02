import { db, architectureHealthSnapshot } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/eam/health-score/trend — Health score trend (12 months)
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth("admin", "viewer");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const snapshots = await db
    .select()
    .from(architectureHealthSnapshot)
    .where(eq(architectureHealthSnapshot.orgId, ctx.orgId))
    .orderBy(desc(architectureHealthSnapshot.snapshotAt))
    .limit(12);

  return Response.json({ data: snapshots.reverse() });
});
