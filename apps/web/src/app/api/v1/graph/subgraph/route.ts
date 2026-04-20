import { graphSubgraphQuerySchema } from "@grc/shared";
import { withAuth } from "@/lib/api";
import { getSubgraph, enrichGraphNodes } from "@grc/graph";

// GET /api/v1/graph/subgraph?entityId=X&entityType=Y&depth=3
// Returns enriched subgraph around a starting entity.
// Access: admin, risk_manager
export async function GET(req: Request) {
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
    console.error("[graph/subgraph] Error:", err);
    return Response.json(
      { error: "Failed to retrieve subgraph" },
      { status: 500 },
    );
  }
}
