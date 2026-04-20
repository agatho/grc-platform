import { db, regulatorySource } from "@grc/db";
import {
  createRegulatorySourceSchema,
  regulatorySourceQuerySchema,
} from "@grc/shared";
import { eq, and, desc, sql, or, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/regulatory-changes/sources — Create source
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "dpo");
  if (ctx instanceof Response) return ctx;

  const body = createRegulatorySourceSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(regulatorySource)
      .values({ ...body.data, orgId: ctx.orgId })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}

// GET /api/v1/regulatory-changes/sources — List sources
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "dpo", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const query = regulatorySourceQuerySchema.safeParse(
    Object.fromEntries(url.searchParams),
  );
  if (!query.success) {
    return Response.json(
      { error: "Invalid query", details: query.error.flatten() },
      { status: 422 },
    );
  }

  const { page, limit, jurisdiction, sourceType, isActive } = query.data;
  const offset = (page - 1) * limit;

  const conditions = [
    or(eq(regulatorySource.orgId, ctx.orgId), isNull(regulatorySource.orgId)),
  ];
  if (jurisdiction)
    conditions.push(eq(regulatorySource.jurisdiction, jurisdiction));
  if (sourceType) conditions.push(eq(regulatorySource.sourceType, sourceType));
  if (isActive !== undefined)
    conditions.push(eq(regulatorySource.isActive, isActive));

  const [sources, countResult] = await Promise.all([
    db
      .select()
      .from(regulatorySource)
      .where(and(...conditions))
      .orderBy(desc(regulatorySource.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(regulatorySource)
      .where(and(...conditions)),
  ]);

  return Response.json({
    data: sources,
    pagination: { page, limit, total: Number(countResult[0]?.count ?? 0) },
  });
}
