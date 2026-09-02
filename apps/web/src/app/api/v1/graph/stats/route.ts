import { withAuth } from "@/lib/api";
import { getGraphStats } from "@grc/graph";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/graph/stats
// Returns overall graph statistics for the organization.
// Access: admin, risk_manager
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  try {
    const stats = await getGraphStats(ctx.orgId);

    return Response.json(stats, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch (err) {
    console.error("[graph/stats] Error:", err);
    return Response.json(
      { error: "Failed to retrieve graph statistics" },
      { status: 500 },
    );
  }
});
