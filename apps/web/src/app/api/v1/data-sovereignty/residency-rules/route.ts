import { db, dataResidencyRule } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import {
  createDataResidencyRuleSchema,
  listDataResidencyRulesQuerySchema,
} from "@grc/shared";

// GET /api/v1/data-sovereignty/residency-rules
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const query = listDataResidencyRulesQuerySchema.parse(
    Object.fromEntries(url.searchParams),
  );
  const conditions = [eq(dataResidencyRule.orgId, ctx.orgId)];
  if (query.ruleType)
    conditions.push(eq(dataResidencyRule.ruleType, query.ruleType));
  if (query.complianceFramework)
    conditions.push(
      eq(dataResidencyRule.complianceFramework, query.complianceFramework),
    );

  const offset = (query.page - 1) * query.limit;
  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(dataResidencyRule)
      .where(and(...conditions))
      .orderBy(desc(dataResidencyRule.createdAt))
      .limit(query.limit)
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(dataResidencyRule)
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

// POST /api/v1/data-sovereignty/residency-rules
export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const body = createDataResidencyRuleSchema.parse(await req.json());

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(dataResidencyRule)
      .values({
        orgId: ctx.orgId,
        ...body,
        createdBy: ctx.userId,
      })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}
