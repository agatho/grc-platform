import { db, horizonScanSource } from "@grc/db";
import {
  createHorizonSourceSchema,
  horizonSourceQuerySchema,
} from "@grc/shared";
import { eq, and, desc, sql, or, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

export async function POST(req: Request) {
  const ctx = await withAuth("admin", "dpo");
  if (ctx instanceof Response) return ctx;
  const body = createHorizonSourceSchema.safeParse(await req.json());
  if (!body.success)
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(horizonScanSource)
      .values({ ...body.data, orgId: ctx.orgId })
      .returning();
    return created;
  });
  return Response.json({ data: result }, { status: 201 });
}

export async function GET(req: Request) {
  const ctx = await withAuth(
    "admin",
    "dpo",
    "risk_manager",
    "auditor",
    "viewer",
  );
  if (ctx instanceof Response) return ctx;
  const url = new URL(req.url);
  const query = horizonSourceQuerySchema.safeParse(
    Object.fromEntries(url.searchParams),
  );
  if (!query.success)
    return Response.json(
      { error: "Invalid query", details: query.error.flatten() },
      { status: 422 },
    );
  const { page, limit, sourceType, jurisdiction, isActive } = query.data;
  const offset = (page - 1) * limit;
  const conditions = [
    or(eq(horizonScanSource.orgId, ctx.orgId), isNull(horizonScanSource.orgId)),
  ];
  if (sourceType) conditions.push(eq(horizonScanSource.sourceType, sourceType));
  if (jurisdiction)
    conditions.push(eq(horizonScanSource.jurisdiction, jurisdiction));
  if (isActive !== undefined)
    conditions.push(eq(horizonScanSource.isActive, isActive));

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(horizonScanSource)
      .where(and(...conditions))
      .orderBy(desc(horizonScanSource.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(horizonScanSource)
      .where(and(...conditions)),
  ]);
  return Response.json({
    data: rows,
    pagination: { page, limit, total: Number(countResult[0]?.count ?? 0) },
  });
}
