import { db, process, processReviewSchedule } from "@grc/db";
import { requireModule } from "@grc/auth";
import { createReviewScheduleSchema } from "@grc/shared";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// GET /api/v1/processes/:id/review-schedule — Get review schedule
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  // Verify process exists
  const [proc] = await db
    .select({ id: process.id })
    .from(process)
    .where(
      and(
        eq(process.id, id),
        eq(process.orgId, ctx.orgId),
        isNull(process.deletedAt),
      ),
    );

  if (!proc) {
    return Response.json({ error: "Process not found" }, { status: 404 });
  }

  // Fetch active review schedule
  const [schedule] = await db
    .select()
    .from(processReviewSchedule)
    .where(
      and(
        eq(processReviewSchedule.processId, id),
        eq(processReviewSchedule.orgId, ctx.orgId),
      ),
    );

  return Response.json({ data: schedule ?? null });
}

// POST /api/v1/processes/:id/review-schedule — Create or update (upsert) review schedule
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "process_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const body = createReviewScheduleSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Verify processId in body matches route param
  if (body.data.processId !== id) {
    return Response.json(
      { error: "Process ID in body does not match route parameter" },
      { status: 422 },
    );
  }

  // Verify process exists
  const [proc] = await db
    .select({ id: process.id })
    .from(process)
    .where(
      and(
        eq(process.id, id),
        eq(process.orgId, ctx.orgId),
        isNull(process.deletedAt),
      ),
    );

  if (!proc) {
    return Response.json({ error: "Process not found" }, { status: 404 });
  }

  // Check if a schedule already exists for this process
  const [existing] = await db
    .select({ id: processReviewSchedule.id })
    .from(processReviewSchedule)
    .where(
      and(
        eq(processReviewSchedule.processId, id),
        eq(processReviewSchedule.orgId, ctx.orgId),
      ),
    );

  const result = await withAuditContext(ctx, async (tx) => {
    if (existing) {
      // Update existing schedule
      const [row] = await tx
        .update(processReviewSchedule)
        .set({
          reviewIntervalMonths: body.data.reviewIntervalMonths,
          nextReviewDate: body.data.nextReviewDate,
          assignedReviewerId: body.data.assignedReviewerId ?? null,
          isActive: body.data.isActive,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(processReviewSchedule.id, existing.id),
            eq(processReviewSchedule.orgId, ctx.orgId),
          ),
        )
        .returning();
      return row;
    } else {
      // Create new schedule
      const [row] = await tx
        .insert(processReviewSchedule)
        .values({
          orgId: ctx.orgId,
          processId: id,
          reviewIntervalMonths: body.data.reviewIntervalMonths,
          nextReviewDate: body.data.nextReviewDate,
          assignedReviewerId: body.data.assignedReviewerId ?? null,
          isActive: body.data.isActive,
          createdBy: ctx.userId,
        })
        .returning();
      return row;
    }
  });

  return Response.json({ data: result }, { status: existing ? 200 : 201 });
}

// DELETE /api/v1/processes/:id/review-schedule — Deactivate schedule
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "process_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  // Verify process exists
  const [proc] = await db
    .select({ id: process.id })
    .from(process)
    .where(
      and(
        eq(process.id, id),
        eq(process.orgId, ctx.orgId),
        isNull(process.deletedAt),
      ),
    );

  if (!proc) {
    return Response.json({ error: "Process not found" }, { status: 404 });
  }

  // Find active schedule
  const [existing] = await db
    .select({
      id: processReviewSchedule.id,
      isActive: processReviewSchedule.isActive,
    })
    .from(processReviewSchedule)
    .where(
      and(
        eq(processReviewSchedule.processId, id),
        eq(processReviewSchedule.orgId, ctx.orgId),
      ),
    );

  if (!existing) {
    return Response.json(
      { error: "Review schedule not found" },
      { status: 404 },
    );
  }

  if (!existing.isActive) {
    return Response.json(
      { error: "Review schedule is already inactive" },
      { status: 422 },
    );
  }

  await withAuditContext(ctx, async (tx) => {
    await tx
      .update(processReviewSchedule)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(processReviewSchedule.id, existing.id),
          eq(processReviewSchedule.orgId, ctx.orgId),
        ),
      );
  });

  return Response.json({ data: { id: existing.id, deactivated: true } });
}
