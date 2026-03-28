import { db, aiSystem } from "@grc/db";
import { createAiSystemSchema, aiSystemQuerySchema } from "@grc/shared";
import { eq, and, desc, sql, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "dpo");
  if (ctx instanceof Response) return ctx;
  const body = createAiSystemSchema.safeParse(await req.json());
  if (!body.success) return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx.insert(aiSystem).values({ ...body.data, orgId: ctx.orgId }).returning();
    return created;
  });
  return Response.json({ data: result }, { status: 201 });
}

export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "dpo", "auditor", "viewer");
  if (ctx instanceof Response) return ctx;
  const url = new URL(req.url);
  const query = aiSystemQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!query.success) return Response.json({ error: "Invalid query", details: query.error.flatten() }, { status: 422 });

  const { page, limit, riskClassification, status, providerOrDeployer } = query.data;
  const offset = (page - 1) * limit;
  const conditions = [eq(aiSystem.orgId, ctx.orgId), isNull(aiSystem.deletedAt)];
  if (riskClassification) conditions.push(eq(aiSystem.riskClassification, riskClassification));
  if (status) conditions.push(eq(aiSystem.status, status));
  if (providerOrDeployer) conditions.push(eq(aiSystem.providerOrDeployer, providerOrDeployer));

  const [rows, countResult] = await Promise.all([
    db.select().from(aiSystem).where(and(...conditions)).orderBy(desc(aiSystem.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(aiSystem).where(and(...conditions)),
  ]);
  return Response.json({ data: rows, pagination: { page, limit, total: Number(countResult[0]?.count ?? 0) } });
}
