import { graphSubgraphQuerySchema } from "@grc/shared";
import { withAuth } from "@/lib/api";
import { getSubgraph, enrichGraphNodes } from "@grc/graph";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";
import { log } from "@/lib/logger";

// GET /api/v1/graph/subgraph?entityId=X&entityType=Y&depth=3
// Returns enriched subgraph around a starting entity.
// Access: admin, risk_manager
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const params = Object.fromEntries(url.searchParams.entries());
  const parsed = graphSubgraphQuerySchema.safeParse(params);

  if (!parsed.success) {
    return Response.json(
      { error: "Invalid parameters", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const {
    entityId,
    entityType,
    depth,
    entityTypes,
    relationshipTypes,
    minWeight,
  } = parsed.data;

  try {
    const rawGraph = await getSubgraph(ctx.orgId, entityId, entityType, depth, {
      entityTypes: entityTypes ?? undefined,
      relationshipTypes: relationshipTypes ?? undefined,
      minWeight: minWeight ?? undefined,
    });

    const enriched = await enrichGraphNodes(rawGraph);

    return Response.json(enriched, {
      headers: { "Cache-Control": "private, max-age=30" },
    });
  } catch (err) {
    log.error("[graph/subgraph] request failed", { err });
    return Response.json(
      { error: "Failed to retrieve subgraph" },
      { status: 500 },
    );
  }
});
