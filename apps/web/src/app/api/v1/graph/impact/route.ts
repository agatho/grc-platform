import { graphImpactBodySchema } from "@grc/shared";
import { withAuth } from "@/lib/api";
import { analyzeImpact } from "@grc/graph";

// POST /api/v1/graph/impact
// Run impact analysis for an entity. Returns affected entities with distance-based impact decay.
// Access: admin, risk_manager
export async function POST(req: Request) {
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
    console.error("[graph/impact] Error:", err);
    return Response.json(
      { error: "Failed to run impact analysis" },
      { status: 500 },
    );
  }
}
