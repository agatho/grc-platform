import { db, retentionSchedule } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, count, desc } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
import { createRetentionScheduleSchema } from "@grc/shared";

// GET /api/v1/dpms/retention-schedules — List retention schedules
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("dpms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset } = paginate(req);
  const where = eq(retentionSchedule.orgId, ctx.orgId);

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(retentionSchedule)
      .where(where)
      .orderBy(desc(retentionSchedule.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(retentionSchedule).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}

// POST /api/v1/dpms/retention-schedules — Create retention schedule
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "dpo");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("dpms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createRetentionScheduleSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [item] = await tx
      .insert(retentionSchedule)
      .values({
        orgId: ctx.orgId,
        createdBy: ctx.userId,
        ...body.data,
      })
      .returning();
    return item;
  });

  return Response.json({ data: created }, { status: 201 });
}
