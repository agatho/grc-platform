import { db, doraIctRisk } from "@grc/db";
import { createDoraIctRiskSchema, doraIctRiskQuerySchema } from "@grc/shared";
import { eq, and, desc, sql, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/dora/ict-risks — Create ICT Risk
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const body = createDoraIctRiskSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(doraIctRisk)
      .values({ ...body.data, orgId: ctx.orgId })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}

// GET /api/v1/dora/ict-risks — List ICT Risks
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "auditor", "viewer");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const query = doraIctRiskQuerySchema.safeParse(
    Object.fromEntries(url.searchParams),
  );
  if (!query.success) {
    return Response.json(
      { error: "Invalid query", details: query.error.flatten() },
      { status: 422 },
    );
  }

  const { page, limit, riskLevel, status, ictAssetType } = query.data;
  const offset = (page - 1) * limit;

  const conditions = [
    eq(doraIctRisk.orgId, ctx.orgId),
    isNull(doraIctRisk.deletedAt),
  ];
  if (riskLevel) conditions.push(eq(doraIctRisk.riskLevel, riskLevel));
  if (status) conditions.push(eq(doraIctRisk.status, status));
  if (ictAssetType) conditions.push(eq(doraIctRisk.ictAssetType, ictAssetType));

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(doraIctRisk)
      .where(and(...conditions))
      .orderBy(desc(doraIctRisk.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(doraIctRisk)
      .where(and(...conditions)),
  ]);

  return Response.json({
    data: rows,
    pagination: { page, limit, total: Number(countResult[0]?.count ?? 0) },
  });
}
