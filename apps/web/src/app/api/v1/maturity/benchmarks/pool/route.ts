import { db, benchmarkPool } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { listBenchmarksQuerySchema } from "@grc/shared";

// GET /api/v1/maturity/benchmarks/pool — List anonymized benchmark data
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const query = listBenchmarksQuerySchema.parse(
    Object.fromEntries(url.searchParams),
  );

  const conditions = [];
  if (query.moduleKey)
    conditions.push(eq(benchmarkPool.moduleKey, query.moduleKey));
  if (query.industry)
    conditions.push(eq(benchmarkPool.industry, query.industry));
  if (query.orgSizeRange)
    conditions.push(eq(benchmarkPool.orgSizeRange, query.orgSizeRange));
  if (query.periodLabel)
    conditions.push(eq(benchmarkPool.periodLabel, query.periodLabel));

  const rows =
    conditions.length > 0
      ? await db
          .select()
          .from(benchmarkPool)
          .where(and(...conditions))
      : await db.select().from(benchmarkPool);

  return Response.json({ data: rows });
}
