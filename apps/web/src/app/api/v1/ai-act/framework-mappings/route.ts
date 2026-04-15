import { db, aiFrameworkMapping } from "@grc/db";
import { createAiFrameworkMappingSchema, aiFrameworkMappingQuerySchema } from "@grc/shared";
import { eq, and, desc, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "dpo");
  if (ctx instanceof Response) return ctx;
  const body = createAiFrameworkMappingSchema.safeParse(await req.json());
  if (!body.success) return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx.insert(aiFrameworkMapping).values({ ...body.data, orgId: ctx.orgId }).returning();
    return created;
  });
  return Response.json({ data: result }, { status: 201 });
}

export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "dpo", "auditor", "viewer");
  if (ctx instanceof Response) return ctx;
  const url = new URL(req.url);
  const query = aiFrameworkMappingQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!query.success) return Response.json({ error: "Invalid query", details: query.error.flatten() }, { status: 422 });

  const { page, limit, framework, implementationStatus } = query.data;
  const offset = (page - 1) * limit;
  const conditions = [eq(aiFrameworkMapping.orgId, ctx.orgId)];
  if (framework) conditions.push(eq(aiFrameworkMapping.framework, framework));
  if (implementationStatus) conditions.push(eq(aiFrameworkMapping.implementationStatus, implementationStatus));

  const [rows, countResult] = await Promise.all([
    db.select().from(aiFrameworkMapping).where(and(...conditions)).orderBy(desc(aiFrameworkMapping.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(aiFrameworkMapping).where(and(...conditions)),
  ]);
  return Response.json({ data: rows, pagination: { page, limit, total: Number(countResult[0]?.count ?? 0) } });
}
