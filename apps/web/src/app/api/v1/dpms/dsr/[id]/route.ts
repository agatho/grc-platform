import { db, dsr, dsrActivity, user } from "@grc/db";
import { updateDsrSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// GET /api/v1/dpms/dsr/:id — Full DSR detail
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dpms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [row] = await db
    .select({
      id: dsr.id,
      orgId: dsr.orgId,
      workItemId: dsr.workItemId,
      requestType: dsr.requestType,
      status: dsr.status,
      subjectName: dsr.subjectName,
      subjectEmail: dsr.subjectEmail,
      receivedAt: dsr.receivedAt,
      deadline: dsr.deadline,
      verifiedAt: dsr.verifiedAt,
      respondedAt: dsr.respondedAt,
      closedAt: dsr.closedAt,
      handlerId: dsr.handlerId,
      handlerName: user.name,
      notes: dsr.notes,
      createdAt: dsr.createdAt,
      updatedAt: dsr.updatedAt,
      createdBy: dsr.createdBy,
    })
    .from(dsr)
    .leftJoin(user, eq(dsr.handlerId, user.id))
    .where(and(eq(dsr.id, id), eq(dsr.orgId, ctx.orgId)));

  if (!row) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const activities = await db
    .select()
    .from(dsrActivity)
    .where(and(eq(dsrActivity.dsrId, id), eq(dsrActivity.orgId, ctx.orgId)));

  return Response.json({ data: { ...row, activities } });
}

// PUT /api/v1/dpms/dsr/:id — Update DSR fields
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "dpo");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dpms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [existing] = await db
    .select()
    .from(dsr)
    .where(and(eq(dsr.id, id), eq(dsr.orgId, ctx.orgId)));

  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = updateDsrSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(dsr)
      .set({
        ...body.data,
        updatedAt: new Date(),
      })
      .where(eq(dsr.id, id))
      .returning();
    return row;
  });

  return Response.json({ data: updated });
}
