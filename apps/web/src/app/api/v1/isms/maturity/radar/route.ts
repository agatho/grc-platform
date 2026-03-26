import { db, controlMaturity, control } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/isms/maturity/radar — avg maturity per domain/department
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // Group maturity by control department (domain proxy)
  const rows = await db
    .select({
      axis: sql<string>`coalesce(${control.department}, 'Uncategorized')`,
      current: sql<number>`round(avg(${controlMaturity.currentMaturity})::numeric, 1)`,
      target: sql<number>`round(avg(${controlMaturity.targetMaturity})::numeric, 1)`,
    })
    .from(controlMaturity)
    .innerJoin(control, eq(controlMaturity.controlId, control.id))
    .where(eq(controlMaturity.orgId, ctx.orgId))
    .groupBy(control.department);

  return Response.json({ data: rows });
}
