import { db, threatFeedSource } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { updateThreatFeedSourceSchema } from "@grc/shared";

// PUT /api/v1/isms/threats/feeds/[id]
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const body = updateThreatFeedSourceSchema.parse(await req.json());

  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx
      .update(threatFeedSource)
      .set(body)
      .where(
        and(eq(threatFeedSource.id, id), eq(threatFeedSource.orgId, ctx.orgId)),
      )
      .returning();
    return updated;
  });

  if (!result) {
    return Response.json({ error: "Feed source not found" }, { status: 404 });
  }

  return Response.json({ data: result });
}

// DELETE /api/v1/isms/threats/feeds/[id]
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  await withAuditContext(ctx, async (tx) => {
    await tx
      .delete(threatFeedSource)
      .where(
        and(eq(threatFeedSource.id, id), eq(threatFeedSource.orgId, ctx.orgId)),
      );
  });

  return Response.json({ success: true });
}
