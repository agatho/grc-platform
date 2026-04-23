import { db, auditActivity, audit, user } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, count, desc } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string }> };

const createActivitySchema = z.object({
  activityType: z.string().min(1).max(100),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  duration: z.number().int().positive().optional(),
  notes: z.string().optional(),
});

// POST /api/v1/audit-mgmt/audits/[id]/activities — Log activity
export async function POST(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const ctx = await withAuth("admin", "auditor");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // Verify audit exists
  const [existing] = await db
    .select({ id: audit.id })
    .from(audit)
    .where(
      and(
        eq(audit.id, id),
        eq(audit.orgId, ctx.orgId),
        isNull(audit.deletedAt),
      ),
    );

  if (!existing) {
    return Response.json({ error: "Audit not found" }, { status: 404 });
  }

  const body = createActivitySchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(auditActivity)
      .values({
        orgId: ctx.orgId,
        auditId: id,
        activityType: body.data.activityType,
        title: body.data.title,
        description: body.data.description,
        performedBy: ctx.userId,
        duration: body.data.duration,
        notes: body.data.notes,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/audit-mgmt/audits/[id]/activities — List activities for audit
export async function GET(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset } = paginate(req);

  const where = and(
    eq(auditActivity.auditId, id),
    eq(auditActivity.orgId, ctx.orgId),
  );

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: auditActivity.id,
        orgId: auditActivity.orgId,
        auditId: auditActivity.auditId,
        activityType: auditActivity.activityType,
        title: auditActivity.title,
        description: auditActivity.description,
        performedBy: auditActivity.performedBy,
        performedByName: user.name,
        performedAt: auditActivity.performedAt,
        duration: auditActivity.duration,
        notes: auditActivity.notes,
        createdAt: auditActivity.createdAt,
      })
      .from(auditActivity)
      .leftJoin(user, eq(auditActivity.performedBy, user.id))
      .where(where)
      .orderBy(desc(auditActivity.performedAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(auditActivity).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
