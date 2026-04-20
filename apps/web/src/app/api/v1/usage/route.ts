import { db, usageRecord, usageMeter } from "@grc/db";
import { recordUsageSchema, usageQuerySchema } from "@grc/shared";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";

// POST /api/v1/usage — Record usage
export async function POST(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const body = recordUsageSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Look up meter
  const [meter] = await db
    .select()
    .from(usageMeter)
    .where(eq(usageMeter.key, body.data.meterKey));

  if (!meter) {
    return Response.json({ error: "Usage meter not found" }, { status: 404 });
  }

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const [created] = await db
    .insert(usageRecord)
    .values({
      orgId: ctx.orgId,
      meterId: meter.id,
      quantity: String(body.data.quantity),
      periodStart,
      periodEnd,
      metadata: body.data.metadata,
    })
    .returning();

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/usage — Query usage records
export async function GET(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const query = usageQuerySchema.safeParse(
    Object.fromEntries(url.searchParams),
  );
  if (!query.success) {
    return Response.json(
      { error: "Validation failed", details: query.error.flatten() },
      { status: 422 },
    );
  }

  const conditions = [eq(usageRecord.orgId, ctx.orgId)];
  if (query.data.startDate)
    conditions.push(
      gte(usageRecord.periodStart, new Date(query.data.startDate)),
    );
  if (query.data.endDate)
    conditions.push(lte(usageRecord.periodEnd, new Date(query.data.endDate)));

  const { page, limit, offset } = paginate(req);

  const rows = await db
    .select({
      record: usageRecord,
      meter: {
        key: usageMeter.key,
        name: usageMeter.name,
        unit: usageMeter.unit,
      },
    })
    .from(usageRecord)
    .innerJoin(usageMeter, eq(usageRecord.meterId, usageMeter.id))
    .where(and(...conditions))
    .orderBy(desc(usageRecord.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(usageRecord)
    .where(and(...conditions));

  return Response.json(paginatedResponse(rows, Number(count), page, limit));
}
