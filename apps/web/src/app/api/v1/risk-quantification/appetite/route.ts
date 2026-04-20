import { db, riskAppetiteThreshold } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import {
  createRiskAppetiteThresholdSchema,
  listRiskAppetiteThresholdsQuerySchema,
} from "@grc/shared";

// GET /api/v1/risk-quantification/appetite
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const query = listRiskAppetiteThresholdsQuerySchema.parse(
    Object.fromEntries(url.searchParams),
  );
  const conditions = [eq(riskAppetiteThreshold.orgId, ctx.orgId)];
  // query.status is an appetite *evaluation* (within_appetite/exceeds_…) — not
  // a stored column — so it cannot be filtered in SQL here. It's applied as a
  // post-filter by callers that need it.
  if (query.category)
    conditions.push(eq(riskAppetiteThreshold.riskCategory, query.category));

  const offset = (query.page - 1) * query.limit;
  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(riskAppetiteThreshold)
      .where(and(...conditions))
      .orderBy(desc(riskAppetiteThreshold.createdAt))
      .limit(query.limit)
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(riskAppetiteThreshold)
      .where(and(...conditions)),
  ]);

  return Response.json({
    data: rows,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  });
}

// POST /api/v1/risk-quantification/appetite
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createRiskAppetiteThresholdSchema.parse(await req.json());
  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(riskAppetiteThreshold)
      .values({
        orgId: ctx.orgId,
        ...body,
      })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}
