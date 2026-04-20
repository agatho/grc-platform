import { db, doraIctProvider } from "@grc/db";
import {
  createDoraIctProviderSchema,
  doraIctProviderQuerySchema,
} from "@grc/shared";
import { eq, and, desc, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const body = createDoraIctProviderSchema.safeParse(await req.json());
  if (!body.success)
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(doraIctProvider)
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
  const query = doraIctProviderQuerySchema.safeParse(
    Object.fromEntries(url.searchParams),
  );
  if (!query.success)
    return Response.json(
      { error: "Invalid query", details: query.error.flatten() },
      { status: 422 },
    );

  const { page, limit, criticality, status, complianceStatus } = query.data;
  const offset = (page - 1) * limit;
  const conditions = [eq(doraIctProvider.orgId, ctx.orgId)];
  if (criticality)
    conditions.push(eq(doraIctProvider.criticality, criticality));
  if (status) conditions.push(eq(doraIctProvider.status, status));
  if (complianceStatus)
    conditions.push(eq(doraIctProvider.complianceStatus, complianceStatus));

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(doraIctProvider)
      .where(and(...conditions))
      .orderBy(desc(doraIctProvider.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(doraIctProvider)
      .where(and(...conditions)),
  ]);
  return Response.json({
    data: rows,
    pagination: { page, limit, total: Number(countResult[0]?.count ?? 0) },
  });
}
