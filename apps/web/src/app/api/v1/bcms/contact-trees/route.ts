import { db, crisisContactTree, crisisContactNode } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, count, desc } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
import { createContactTreeSchema } from "@grc/shared";

// GET /api/v1/bcms/contact-trees — List contact trees
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset } = paginate(req);
  const where = eq(crisisContactTree.orgId, ctx.orgId);

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(crisisContactTree)
      .where(where)
      .orderBy(desc(crisisContactTree.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(crisisContactTree).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}

// POST /api/v1/bcms/contact-trees — Create contact tree
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createContactTreeSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [tree] = await tx
      .insert(crisisContactTree)
      .values({
        orgId: ctx.orgId,
        createdBy: ctx.userId,
        ...body.data,
      })
      .returning();
    return tree;
  });

  return Response.json({ data: created }, { status: 201 });
}
