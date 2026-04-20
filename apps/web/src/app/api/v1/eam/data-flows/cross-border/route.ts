import { db, dataFlow } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/eam/data-flows/cross-border — Cross-EU-border flows
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "viewer");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const flows = await db
    .select()
    .from(dataFlow)
    .where(
      and(eq(dataFlow.orgId, ctx.orgId), eq(dataFlow.crossesEuBorder, true)),
    );

  return Response.json({ data: flows });
}
