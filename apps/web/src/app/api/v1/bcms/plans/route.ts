import { db, bcp } from "@grc/db";
import { createBcpSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, count, desc, ilike, or, inArray } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
import type { SQL } from "drizzle-orm";

// POST /api/v1/bcms/plans — Create BCP
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createBcpSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(bcp)
      .values({
        orgId: ctx.orgId,
        title: body.data.title,
        description: body.data.description,
        scope: body.data.scope,
        processIds: body.data.processIds,
        bcManagerId: body.data.bcManagerId,
        activationCriteria: body.data.activationCriteria,
        activationAuthority: body.data.activationAuthority,
        createdBy: ctx.userId,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/bcms/plans — List BCPs
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);

  const conditions: SQL[] = [eq(bcp.orgId, ctx.orgId), isNull(bcp.deletedAt)];

  const statusParam = searchParams.get("status");
  if (statusParam) {
    const statuses = statusParam.split(",") as Array<
      | "draft"
      | "in_review"
      | "approved"
      | "published"
      | "archived"
      | "superseded"
    >;
    conditions.push(inArray(bcp.status, statuses));
  }

  const search = searchParams.get("search");
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(ilike(bcp.title, pattern), ilike(bcp.description, pattern))!,
    );
  }

  const where = and(...conditions);

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(bcp)
      .where(where)
      .orderBy(desc(bcp.updatedAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(bcp).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
