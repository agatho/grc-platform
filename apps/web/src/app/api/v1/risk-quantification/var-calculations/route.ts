import { db, riskVarCalculation } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { triggerVarCalculationSchema, listVarCalculationsQuerySchema } from "@grc/shared";

// GET /api/v1/risk-quantification/var-calculations
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const query = listVarCalculationsQuerySchema.parse(Object.fromEntries(url.searchParams));
  const conditions = [eq(riskVarCalculation.orgId, ctx.orgId)];
  if (query.status) conditions.push(eq(riskVarCalculation.status, query.status));

  const offset = (query.page - 1) * query.limit;
  const [rows, [{ total }]] = await Promise.all([
    db.select().from(riskVarCalculation).where(and(...conditions))
      .orderBy(desc(riskVarCalculation.createdAt)).limit(query.limit).offset(offset),
    db.select({ total: sql<number>`count(*)::int` }).from(riskVarCalculation).where(and(...conditions)),
  ]);

  return Response.json({
    data: rows,
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
  });
}

// POST /api/v1/risk-quantification/var-calculations — Trigger new VaR calculation
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = triggerVarCalculationSchema.parse(await req.json());

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx.insert(riskVarCalculation).values({
      orgId: ctx.orgId,
      entityLabel: body.entityLabel,
      methodology: body.methodology ?? "hybrid",
      iterations: body.iterations ?? 10000,
      computedBy: ctx.userId,
    }).returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}
