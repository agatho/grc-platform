import { withAuth } from "@/lib/api";
import { findOrphans } from "@grc/graph";

// GET /api/v1/graph/orphans
// Returns unlinked entities: risks without controls, controls without tests, etc.
// Access: admin, risk_manager
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  try {
    const orphans = await findOrphans(ctx.orgId);

    return Response.json(orphans, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch (err) {
    console.error("[graph/orphans] Error:", err);
    return Response.json({ error: "Failed to detect orphan entities" }, { status: 500 });
  }
}
