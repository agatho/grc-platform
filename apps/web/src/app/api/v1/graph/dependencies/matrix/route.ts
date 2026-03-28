import { withAuth } from "@/lib/api";
import { getDependencyMatrix } from "@grc/graph";

// GET /api/v1/graph/dependencies/matrix
// Returns dependency matrix (entity type x entity type counts).
// Access: admin, risk_manager
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  try {
    const matrix = await getDependencyMatrix(ctx.orgId);

    return Response.json({ data: matrix }, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch (err) {
    console.error("[graph/matrix] Error:", err);
    return Response.json({ error: "Failed to retrieve dependency matrix" }, { status: 500 });
  }
}
