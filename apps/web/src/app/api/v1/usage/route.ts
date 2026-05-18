import { db, usageRecord, usageMeter } from "@grc/db";
import { recordUsageSchema, usageQuerySchema } from "@grc/shared";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";

// POST /api/v1/usage — Record usage
//
// Idempotency: callers SHOULD include an `Idempotency-Key` header (or
// `idempotencyKey` body field). The same key under the same org collapses
// to one row — necessary to stop double-billing on client/network retries.
// Length capped at 128 characters; longer keys are rejected (422).
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

  const headerKey = req.headers.get("idempotency-key");
  const bodyKey = body.data.idempotencyKey;
  const rawKey = headerKey ?? bodyKey ?? null;
  if (rawKey !== null && rawKey.length > 128) {
    return Response.json(
      { error: "Idempotency-Key must be ≤ 128 characters" },
      { status: 422 },
    );
  }
  const idempotencyKey = rawKey;

  // Look up meter
  const [meter] = await db
    .select()
    .from(usageMeter)
    .where(eq(usageMeter.key, body.data.meterKey));

  if (!meter) {
    return Response.json({ error: "Usage meter not found" }, { status: 404 });
  }

  // If the caller supplied an idempotency key and a matching row exists,
  // return it as-is rather than re-inserting. Two layers of defence:
  // 1. Pre-check here keeps the happy path cheap (one SELECT).
  // 2. Partial unique index (migration 0344) is the actual integrity
  //    guarantee — covers the race between two concurrent retries.
  if (idempotencyKey) {
    const [existing] = await db
      .select()
      .from(usageRecord)
      .where(
        and(
          eq(usageRecord.orgId, ctx.orgId),
          eq(usageRecord.idempotencyKey, idempotencyKey),
        ),
      );
    if (existing) {
      return Response.json(
        { data: existing, idempotent: true },
        { status: 200 },
      );
    }
  }

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  try {
    const [created] = await db
      .insert(usageRecord)
      .values({
        orgId: ctx.orgId,
        meterId: meter.id,
        quantity: String(body.data.quantity),
        periodStart,
        periodEnd,
        metadata: body.data.metadata,
        idempotencyKey,
      })
      .returning();

    return Response.json({ data: created }, { status: 201 });
  } catch (err) {
    // Concurrent retry: the unique index fired between our pre-check and
    // our insert. Look up the winning row and return it.
    const message = err instanceof Error ? err.message : String(err);
    if (idempotencyKey && /usage_record_idem_uq/i.test(message)) {
      const [existing] = await db
        .select()
        .from(usageRecord)
        .where(
          and(
            eq(usageRecord.orgId, ctx.orgId),
            eq(usageRecord.idempotencyKey, idempotencyKey),
          ),
        );
      if (existing) {
        return Response.json(
          { data: existing, idempotent: true },
          { status: 200 },
        );
      }
    }
    throw err;
  }
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
