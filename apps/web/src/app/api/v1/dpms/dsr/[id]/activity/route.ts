import { db, dsr, dsrActivity } from "@grc/db";
import { createDsrActivitySchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/dpms/dsr/:id/activity — Add activity to DSR
export async function POST(
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
    return Response.json({ error: "DSR not found" }, { status: 404 });
  }

  const body = createDsrActivitySchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(dsrActivity)
      .values({
        orgId: ctx.orgId,
        dsrId: id,
        activityType: body.data.activityType,
        details: body.data.details,
        createdBy: ctx.userId,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/dpms/dsr/:id/activity — List activities for a DSR
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dpms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const activities = await db
    .select()
    .from(dsrActivity)
    .where(and(eq(dsrActivity.dsrId, id), eq(dsrActivity.orgId, ctx.orgId)))
    .orderBy(desc(dsrActivity.timestamp));

  return Response.json({ data: activities });
}
