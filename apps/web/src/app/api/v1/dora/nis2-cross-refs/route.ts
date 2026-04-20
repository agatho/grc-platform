import { db, doraNis2CrossRef } from "@grc/db";
import { createDoraNis2CrossRefSchema, doraNis2QuerySchema } from "@grc/shared";
import { eq, and, desc, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const body = createDoraNis2CrossRefSchema.safeParse(await req.json());
  if (!body.success)
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(doraNis2CrossRef)
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
  const query = doraNis2QuerySchema.safeParse(
    Object.fromEntries(url.searchParams),
  );
  if (!query.success)
    return Response.json(
      { error: "Invalid query", details: query.error.flatten() },
      { status: 422 },
    );

  const { page, limit, overlapType, complianceStatus } = query.data;
  const offset = (page - 1) * limit;
  const conditions = [eq(doraNis2CrossRef.orgId, ctx.orgId)];
  if (overlapType)
    conditions.push(eq(doraNis2CrossRef.overlapType, overlapType));
  if (complianceStatus)
    conditions.push(eq(doraNis2CrossRef.complianceStatus, complianceStatus));

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(doraNis2CrossRef)
      .where(and(...conditions))
      .orderBy(desc(doraNis2CrossRef.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(doraNis2CrossRef)
      .where(and(...conditions)),
  ]);
  return Response.json({
    data: rows,
    pagination: { page, limit, total: Number(countResult[0]?.count ?? 0) },
  });
}
