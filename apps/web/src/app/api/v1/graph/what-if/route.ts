import { graphWhatIfBodySchema } from "@grc/shared";
import { withAuth } from "@/lib/api";
import { runWhatIf } from "@grc/graph";

// POST /api/v1/graph/what-if
// Run what-if scenario simulation. READ-ONLY: no actual mutations.
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

  const parsed = graphWhatIfBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid parameters", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { entityId, entityType, scenario, maxDepth } = parsed.data;

  try {
    const result = await runWhatIf(ctx.orgId, entityId, entityType, scenario, maxDepth);

    return Response.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[graph/what-if] Error:", err);
    return Response.json({ error: "Failed to run what-if simulation" }, { status: 500 });
  }
}
