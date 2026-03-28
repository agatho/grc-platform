import { db, riskEvent } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, count, desc } from "drizzle-orm";
import { withAuth, withAuditContext, paginate, paginatedResponse } from "@/lib/api";
import { createRiskEventSchema } from "@grc/shared";

// GET /api/v1/erm/risk-events — List risk events
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);
  const conditions = [eq(riskEvent.orgId, ctx.orgId)];
  const eventType = searchParams.get("eventType");
  if (eventType) conditions.push(eq(riskEvent.eventType, eventType));

  const where = and(...conditions);

  const [items, [{ value: total }]] = await Promise.all([
    db.select().from(riskEvent).where(where)
      .orderBy(desc(riskEvent.eventDate)).limit(limit).offset(offset),
    db.select({ value: count() }).from(riskEvent).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}

// POST /api/v1/erm/risk-events — Create risk event
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createRiskEventSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [item] = await tx.insert(riskEvent).values({
      orgId: ctx.orgId,
      createdBy: ctx.userId,
      ...body.data,
    }).returning();
    return item;
  });

  return Response.json({ data: created }, { status: 201 });
}
