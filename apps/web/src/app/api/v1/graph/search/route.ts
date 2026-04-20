import { graphSearchQuerySchema } from "@grc/shared";
import { withAuth } from "@/lib/api";
import { searchEntities } from "@grc/graph";

// GET /api/v1/graph/search?q=term
// Search entities across all types for graph display.
// Access: admin, risk_manager
export async function GET(req: Request) {
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
    console.error("[graph/search] Error:", err);
    return Response.json(
      { error: "Failed to search entities" },
      { status: 500 },
    );
  }
}
