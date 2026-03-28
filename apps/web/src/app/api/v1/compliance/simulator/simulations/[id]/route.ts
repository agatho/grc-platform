import { db, regulationSimulation } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/compliance/simulator/simulations/:id — Simulation detail
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [row] = await db
    .select()
    .from(regulationSimulation)
    .where(
      and(
        eq(regulationSimulation.id, id),
        eq(regulationSimulation.orgId, ctx.orgId),
      ),
    );

  if (!row) {
    return Response.json({ error: "Simulation not found" }, { status: 404 });
  }

  return Response.json({ data: row });
}
