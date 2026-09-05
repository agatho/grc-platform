import { db, crossRegionReplication } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { updateCrossRegionReplicationSchema } from "@grc/shared";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/data-sovereignty/replications/:id
export const GET = withErrorHandler(async function GET(
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
});
// PATCH /api/v1/data-sovereignty/replications/:id
export const PATCH = withErrorHandler(async function PATCH(
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
});
