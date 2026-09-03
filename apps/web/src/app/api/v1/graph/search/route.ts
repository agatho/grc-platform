import { graphSearchQuerySchema } from "@grc/shared";
import { withAuth } from "@/lib/api";
import { searchEntities } from "@grc/graph";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";
import { log } from "@/lib/logger";

// GET /api/v1/graph/search?q=term
// Search entities across all types for graph display.
// Access: admin, risk_manager
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const params = Object.fromEntries(url.searchParams.entries());
  const parsed = graphSearchQuerySchema.safeParse(params);

  if (!parsed.success) {
    return Response.json(
      { error: "Invalid parameters", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { q, limit } = parsed.data;

  try {
    const results = await searchEntities(ctx.orgId, q, limit);

    return Response.json(
      { data: results },
      {
        headers: { "Cache-Control": "private, max-age=10" },
      },
    );
  } catch (err) {
    log.error("[graph/search] request failed", { err });
    return Response.json(
      { error: "Failed to search entities" },
      { status: 500 },
    );
  }
});
