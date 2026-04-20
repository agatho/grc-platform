import { db, process, processVersion, processStep, user } from "@grc/db";
import { processRisk } from "@grc/db";
import { updateProcessSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, count, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { alias } from "drizzle-orm/pg-core";

// GET /api/v1/processes/:id — Full detail
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const ownerUser = alias(user, "ownerUser");
  const reviewerUser = alias(user, "reviewerUser");

  const [row] = await db
    .select({
      id: process.id,
      orgId: process.orgId,
      parentProcessId: process.parentProcessId,
      name: process.name,
      description: process.description,
      level: process.level,
      notation: process.notation,
      status: process.status,
      processOwnerId: process.processOwnerId,
      processOwnerName: ownerUser.name,
      reviewerId: process.reviewerId,
      reviewerName: reviewerUser.name,
      department: process.department,
      currentVersion: process.currentVersion,
      isEssential: process.isEssential,
      publishedAt: process.publishedAt,
      createdAt: process.createdAt,
      updatedAt: process.updatedAt,
      createdBy: process.createdBy,
      updatedBy: process.updatedBy,
    })
    .from(process)
    .leftJoin(ownerUser, eq(process.processOwnerId, ownerUser.id))
    .leftJoin(reviewerUser, eq(process.reviewerId, reviewerUser.id))
    .where(
      and(
        eq(process.id, id),
        eq(process.orgId, ctx.orgId),
        isNull(process.deletedAt),
      ),
    );

  if (!row) {
    return Response.json({ error: "Process not found" }, { status: 404 });
  }

  // Get current version
  const [currentVer] = await db
    .select()
    .from(processVersion)
    .where(
      and(eq(processVersion.processId, id), eq(processVersion.isCurrent, true)),
    );

  // Get step count and risk count
  const [[{ value: stepCount }], [{ value: riskCount }]] = await Promise.all([
    db
      .select({ value: count() })
      .from(processStep)
      .where(and(eq(processStep.processId, id), isNull(processStep.deletedAt))),
    db
      .select({ value: count() })
      .from(processRisk)
      .where(eq(processRisk.processId, id)),
  ]);

  return Response.json({
    data: {
      ...row,
      currentVersionData: currentVer ?? null,
      stepCount,
      riskCount,
    },
  });
}

// PUT /api/v1/processes/:id — Update metadata
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "process_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const body = updateProcessSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Verify process exists and belongs to org
  const [existing] = await db
    .select({ id: process.id, processOwnerId: process.processOwnerId })
    .from(process)
    .where(
      and(
        eq(process.id, id),
        eq(process.orgId, ctx.orgId),
        isNull(process.deletedAt),
      ),
    );

  if (!existing) {
    return Response.json({ error: "Process not found" }, { status: 404 });
  }

  // Verify parent if being changed
  if (body.data.parentProcessId) {
    if (body.data.parentProcessId === id) {
      return Response.json(
        { error: "Process cannot be its own parent" },
        { status: 422 },
      );
    }
    const [parent] = await db
      .select({ id: process.id })
      .from(process)
      .where(
        and(
          eq(process.id, body.data.parentProcessId),
          eq(process.orgId, ctx.orgId),
          isNull(process.deletedAt),
        ),
      );
    if (!parent) {
      return Response.json(
        { error: "Parent process not found in this organization" },
        { status: 422 },
      );
    }
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(process)
      .set({
        ...body.data,
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .where(and(eq(process.id, id), eq(process.orgId, ctx.orgId)))
      .returning();
    return row;
  });

  return Response.json({ data: updated });
}

// DELETE /api/v1/processes/:id — Soft delete (admin only)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [existing] = await db
    .select({ id: process.id })
    .from(process)
    .where(
      and(
        eq(process.id, id),
        eq(process.orgId, ctx.orgId),
        isNull(process.deletedAt),
      ),
    );

  if (!existing) {
    return Response.json({ error: "Process not found" }, { status: 404 });
  }

  await withAuditContext(ctx, async (tx) => {
    await tx
      .update(process)
      .set({
        deletedAt: new Date(),
        deletedBy: ctx.userId,
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .where(and(eq(process.id, id), eq(process.orgId, ctx.orgId)));
  });

  return Response.json({ data: { id, deleted: true } });
}
