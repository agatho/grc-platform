import { db, organization } from "@grc/db";
import { createOrganizationSchema } from "@grc/shared";
import { eq, and, isNull, inArray, count } from "drizzle-orm";
import { getAccessibleOrgIds } from "@grc/auth";
import { withAuth, withAuditContext, paginate, paginatedResponse } from "@/lib/api";

// GET /api/v1/organizations — List organizations (admin)
export async function GET(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const orgIds = getAccessibleOrgIds(ctx.session);
  const { page, limit, offset } = paginate(req);

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(organization)
      .where(and(isNull(organization.deletedAt), inArray(organization.id, orgIds)))
      .orderBy(organization.name)
      .limit(limit)
      .offset(offset),
    db
      .select({ value: count() })
      .from(organization)
      .where(and(isNull(organization.deletedAt), inArray(organization.id, orgIds))),
  ]);

  return paginatedResponse(items, total, page, limit);
}

// POST /api/v1/organizations — Create organization (admin)
export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const body = createOrganizationSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(organization)
      .values({ ...body.data, createdBy: ctx.userId, updatedBy: ctx.userId })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}
