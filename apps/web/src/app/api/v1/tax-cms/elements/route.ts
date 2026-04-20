import { db, taxCmsElement } from "@grc/db";
import {
  createTaxCmsElementSchema,
  taxCmsElementQuerySchema,
} from "@grc/shared";
import { eq, and, desc, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const body = createTaxCmsElementSchema.safeParse(await req.json());
  if (!body.success)
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(taxCmsElement)
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
  const query = taxCmsElementQuerySchema.safeParse(
    Object.fromEntries(url.searchParams),
  );
  if (!query.success)
    return Response.json(
      { error: "Invalid query", details: query.error.flatten() },
      { status: 422 },
    );
  const { page, limit, elementType, status } = query.data;
  const offset = (page - 1) * limit;
  const conditions = [eq(taxCmsElement.orgId, ctx.orgId)];
  if (elementType) conditions.push(eq(taxCmsElement.elementType, elementType));
  if (status) conditions.push(eq(taxCmsElement.status, status));
  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(taxCmsElement)
      .where(and(...conditions))
      .orderBy(desc(taxCmsElement.elementNumber))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(taxCmsElement)
      .where(and(...conditions)),
  ]);
  return Response.json({
    data: rows,
    pagination: { page, limit, total: Number(countResult[0]?.count ?? 0) },
  });
}
