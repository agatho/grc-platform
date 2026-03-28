import { db, horizonImpactAssessment } from "@grc/db";
import { createHorizonImpactSchema, horizonImpactQuerySchema } from "@grc/shared";
import { eq, and, desc, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

export async function POST(req: Request) {
  const ctx = await withAuth("admin", "dpo", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const body = createHorizonImpactSchema.safeParse(await req.json());
  if (!body.success) return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });
  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx.insert(horizonImpactAssessment).values({ ...body.data, orgId: ctx.orgId, assessedBy: ctx.userId }).returning();
    return created;
  });
  return Response.json({ data: result }, { status: 201 });
}

export async function GET(req: Request) {
  const ctx = await withAuth("admin", "dpo", "risk_manager", "auditor", "viewer");
  if (ctx instanceof Response) return ctx;
  const url = new URL(req.url);
  const query = horizonImpactQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!query.success) return Response.json({ error: "Invalid query", details: query.error.flatten() }, { status: 422 });
  const { page, limit, impactLevel, status } = query.data;
  const offset = (page - 1) * limit;
  const conditions = [eq(horizonImpactAssessment.orgId, ctx.orgId)];
  if (impactLevel) conditions.push(eq(horizonImpactAssessment.impactLevel, impactLevel));
  if (status) conditions.push(eq(horizonImpactAssessment.status, status));

  const [rows, countResult] = await Promise.all([
    db.select().from(horizonImpactAssessment).where(and(...conditions)).orderBy(desc(horizonImpactAssessment.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(horizonImpactAssessment).where(and(...conditions)),
  ]);
  return Response.json({ data: rows, pagination: { page, limit, total: Number(countResult[0]?.count ?? 0) } });
}
