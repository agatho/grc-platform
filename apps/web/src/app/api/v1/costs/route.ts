import { db, grcCostEntry } from "@grc/db";
import { createCostEntrySchema } from "@grc/shared";
import { eq, and, count, desc } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
import type { SQL } from "drizzle-orm";

// POST /api/v1/costs — Record cost entry
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;

  const body = createCostEntrySchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Validate period
  if (body.data.periodEnd < body.data.periodStart) {
    return Response.json(
      { error: "periodEnd must be >= periodStart" },
      { status: 422 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(grcCostEntry)
      .values({
        orgId: ctx.orgId,
        entityType: body.data.entityType,
        entityId: body.data.entityId,
        costCategory: body.data.costCategory,
        costType: body.data.costType,
        amount: body.data.amount.toString(),
        currency: body.data.currency,
        periodStart: body.data.periodStart,
        periodEnd: body.data.periodEnd,
        department: body.data.department,
        hours: body.data.hours?.toString(),
        hourlyRate: body.data.hourlyRate?.toString(),
        description: body.data.description,
        budgetId: body.data.budgetId,
        invoiceRef: body.data.invoiceRef,
        createdBy: ctx.userId,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/costs — List cost entries (filterable)
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;

  const { page, limit, offset, searchParams } = paginate(req);

  const conditions: SQL[] = [eq(grcCostEntry.orgId, ctx.orgId)];

  const entityType = searchParams.get("entity_type");
  if (entityType) {
    conditions.push(eq(grcCostEntry.entityType, entityType));
  }

  const entityId = searchParams.get("entity_id");
  if (entityId) {
    conditions.push(eq(grcCostEntry.entityId, entityId));
  }

  const costCategory = searchParams.get("cost_category");
  if (costCategory) {
    conditions.push(
      eq(
        grcCostEntry.costCategory,
        costCategory as
          | "personnel"
          | "external"
          | "tools"
          | "training"
          | "measures"
          | "certification",
      ),
    );
  }

  const costType = searchParams.get("cost_type");
  if (costType) {
    conditions.push(
      eq(grcCostEntry.costType, costType as "planned" | "actual" | "forecast"),
    );
  }

  const where = and(...conditions);

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(grcCostEntry)
      .where(where)
      .orderBy(desc(grcCostEntry.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(grcCostEntry).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
