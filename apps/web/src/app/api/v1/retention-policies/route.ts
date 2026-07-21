import { db, retentionPolicy } from "@grc/db";
import { requireModule } from "@grc/auth";
import { createRetentionPolicySchema } from "@grc/shared";
import { eq, and, isNull, asc, count } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";

// GET /api/v1/retention-policies — List retention policies (D3)
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset } = paginate(req);

  const where = and(
    eq(retentionPolicy.orgId, ctx.orgId),
    isNull(retentionPolicy.deletedAt),
  );

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: retentionPolicy.id,
        name: retentionPolicy.name,
        description: retentionPolicy.description,
        retentionYears: retentionPolicy.retentionYears,
        basis: retentionPolicy.basis,
        createdAt: retentionPolicy.createdAt,
        updatedAt: retentionPolicy.updatedAt,
      })
      .from(retentionPolicy)
      .where(where)
      .orderBy(asc(retentionPolicy.name))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(retentionPolicy).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}

// POST /api/v1/retention-policies — Create retention policy (admin only)
export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createRetentionPolicySchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(retentionPolicy)
      .values({
        orgId: ctx.orgId,
        name: body.data.name,
        description: body.data.description,
        retentionYears: body.data.retentionYears,
        basis: body.data.basis,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}
