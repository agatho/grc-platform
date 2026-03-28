import { db, riskExecutiveSummary } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { createRiskExecutiveSummarySchema, listRiskExecutiveSummariesQuerySchema } from "@grc/shared";

// GET /api/v1/risk-quantification/executive-summaries
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const query = listRiskExecutiveSummariesQuerySchema.parse(Object.fromEntries(url.searchParams));
  const conditions = [eq(riskExecutiveSummary.orgId, ctx.orgId)];
  if (query.status) conditions.push(eq(riskExecutiveSummary.status, query.status));

  const offset = (query.page - 1) * query.limit;
  const [rows, [{ total }]] = await Promise.all([
    db.select().from(riskExecutiveSummary).where(and(...conditions))
      .orderBy(desc(riskExecutiveSummary.createdAt)).limit(query.limit).offset(offset),
    db.select({ total: sql<number>`count(*)::int` }).from(riskExecutiveSummary).where(and(...conditions)),
  ]);

  return Response.json({
    data: rows,
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
  });
}

// POST /api/v1/risk-quantification/executive-summaries
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;
  const body = createRiskExecutiveSummarySchema.parse(await req.json());

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx.insert(riskExecutiveSummary).values({
      orgId: ctx.orgId, ...body, createdBy: ctx.userId,
    }).returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}
