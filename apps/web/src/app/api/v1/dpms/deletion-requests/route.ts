import { db, deletionRequest, retentionException } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, count, desc } from "drizzle-orm";
import { withAuth, withAuditContext, paginate, paginatedResponse } from "@/lib/api";
import { createDeletionRequestSchema, isValidDeletionTransition } from "@grc/shared";

// GET /api/v1/dpms/deletion-requests — List deletion requests
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("dpms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);
  const conditions = [eq(deletionRequest.orgId, ctx.orgId)];
  const status = searchParams.get("status");
  if (status) conditions.push(eq(deletionRequest.status, status));

  const where = and(...conditions);

  const [items, [{ value: total }]] = await Promise.all([
    db.select().from(deletionRequest).where(where)
      .orderBy(desc(deletionRequest.createdAt)).limit(limit).offset(offset),
    db.select({ value: count() }).from(deletionRequest).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}

// POST /api/v1/dpms/deletion-requests — Create deletion request
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "dpo");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("dpms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createDeletionRequestSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });
  }

  // Check for active exceptions blocking deletion
  const activeExceptions = await db.select().from(retentionException)
    .where(and(
      eq(retentionException.scheduleId, body.data.scheduleId),
      eq(retentionException.status, "active"),
      eq(retentionException.orgId, ctx.orgId),
    ));

  if (activeExceptions.length > 0) {
    return Response.json({
      error: "Active retention exceptions exist for this schedule. Deletion blocked.",
      exceptions: activeExceptions.map((e) => ({ id: e.id, reason: e.reason, expiresAt: e.expiresAt })),
    }, { status: 422 });
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [item] = await tx.insert(deletionRequest).values({
      orgId: ctx.orgId,
      createdBy: ctx.userId,
      ...body.data,
    }).returning();
    return item;
  });

  return Response.json({ data: created }, { status: 201 });
}
