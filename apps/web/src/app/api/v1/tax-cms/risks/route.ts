import { db, taxRisk } from "@grc/db";
import { createTaxRiskSchema, taxRiskQuerySchema } from "@grc/shared";
import { eq, and, desc, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const body = createTaxRiskSchema.safeParse(await req.json());
  if (!body.success)
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(taxRisk)
      .values({ ...body.data, orgId: ctx.orgId })
      .returning();
    return created;
  });
  return Response.json({ data: result }, { status: 201 });
}

export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "auditor", "viewer");
  if (ctx instanceof Response) return ctx;
  const url = new URL(req.url);
  const query = taxRiskQuerySchema.safeParse(
    Object.fromEntries(url.searchParams),
  );
  if (!query.success)
    return Response.json(
      { error: "Invalid query", details: query.error.flatten() },
      { status: 422 },
    );
  const { page, limit } = query.data;
  const offset = (page - 1) * limit;
  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(taxRisk)
      .where(eq(taxRisk.orgId, ctx.orgId))
      .orderBy(desc(taxRisk.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(taxRisk)
      .where(eq(taxRisk.orgId, ctx.orgId)),
  ]);
  return Response.json({
    data: rows,
    pagination: { page, limit, total: Number(countResult[0]?.count ?? 0) },
  });
}
