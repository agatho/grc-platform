import { graphImpactBodySchema } from "@grc/shared";
import { withAuth } from "@/lib/api";
import { analyzeImpact } from "@grc/graph";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";
import { log } from "@/lib/logger";

// POST /api/v1/graph/impact
// Run impact analysis for an entity. Returns affected entities with distance-based impact decay.
// Access: admin, risk_manager
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = graphImpactBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid parameters", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { entityId, entityType, maxDepth } = parsed.data;

  try {
    const result = await analyzeImpact(ctx.orgId, entityId, entityType, {
      maxDepth,
    });

    return Response.json(result, {
      headers: { "Cache-Control": "private, max-age=15" },
    });
  } catch (err) {
    log.error("[graph/impact] request failed", { err });
    return Response.json(
      { error: "Failed to run impact analysis" },
      { status: 500 },
    );
  }
});
