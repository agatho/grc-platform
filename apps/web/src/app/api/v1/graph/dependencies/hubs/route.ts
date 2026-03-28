import { graphHubsQuerySchema } from "@grc/shared";
import { withAuth } from "@/lib/api";
import { getHubs } from "@grc/graph";

// GET /api/v1/graph/dependencies/hubs
// Returns entities with the most connections (SPOF detection).
// Access: admin, risk_manager
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const params = Object.fromEntries(url.searchParams.entries());
  const parsed = graphHubsQuerySchema.safeParse(params);

  if (!parsed.success) {
    return Response.json(
      { error: "Invalid parameters", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { limit } = parsed.data;

  try {
    const hubs = await getHubs(ctx.orgId, limit);

    return Response.json({ data: hubs }, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch (err) {
    console.error("[graph/hubs] Error:", err);
    return Response.json({ error: "Failed to retrieve hub entities" }, { status: 500 });
  }
}
