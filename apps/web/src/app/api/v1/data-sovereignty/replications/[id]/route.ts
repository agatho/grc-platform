import { db, crossRegionReplication } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { updateCrossRegionReplicationSchema } from "@grc/shared";

// GET /api/v1/data-sovereignty/replications/:id
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const { id } = await params;
  const [row] = await db
    .select()
    .from(crossRegionReplication)
    .where(
      and(
        eq(crossRegionReplication.id, id),
        eq(crossRegionReplication.orgId, ctx.orgId),
      ),
    );
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: row });
}

// PATCH /api/v1/data-sovereignty/replications/:id
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;
  const body = updateCrossRegionReplicationSchema.parse(await req.json());
  const updateData: Record<string, unknown> = {
    ...body,
    updatedAt: new Date(),
  };
  if (body.status === "active") {
    updateData.approvedBy = ctx.userId;
    updateData.approvedAt = new Date();
  }
  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx
      .update(crossRegionReplication)
      .set(updateData)
      .where(
        and(
          eq(crossRegionReplication.id, id),
          eq(crossRegionReplication.orgId, ctx.orgId),
        ),
      )
      .returning();
    return updated;
  });
  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: result });
}
