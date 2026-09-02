import { db, workItemLink } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// DELETE /api/v1/work-items/:id/links/:linkId — Remove link (creator or admin)
export const DELETE = withErrorHandler(async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; linkId: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { id, linkId } = await params;

  // Fetch the link and verify it belongs to this work item and org
  const [link] = await db
    .select()
    .from(workItemLink)
    .where(
      and(
        eq(workItemLink.id, linkId),
        eq(workItemLink.orgId, ctx.orgId),
        eq(workItemLink.sourceId, id),
      ),
    );

  // Also check if it's an incoming link (target matches)
  if (!link) {
    const [incomingLink] = await db
      .select()
      .from(workItemLink)
      .where(
        and(
          eq(workItemLink.id, linkId),
          eq(workItemLink.orgId, ctx.orgId),
          eq(workItemLink.targetId, id),
        ),
      );

    if (!incomingLink) {
      return Response.json({ error: "Link not found" }, { status: 404 });
    }

    // Check permission: creator or admin
    const isCreator = incomingLink.createdBy === ctx.userId;
    const adminCheck = await withAuth("admin");
    const isAdmin = !(adminCheck instanceof Response);

    if (!isAdmin && !isCreator) {
      return Response.json(
        { error: "Forbidden: only admin or link creator can remove this link" },
        { status: 403 },
      );
    }

    await withAuditContext(ctx, async (tx) => {
      await tx.delete(workItemLink).where(eq(workItemLink.id, linkId));
    });

    return Response.json({ data: { id: linkId, deleted: true } });
  }

  // Check permission: creator or admin
  const isCreator = link.createdBy === ctx.userId;
  const adminCheck = await withAuth("admin");
  const isAdmin = !(adminCheck instanceof Response);

  if (!isAdmin && !isCreator) {
    return Response.json(
      { error: "Forbidden: only admin or link creator can remove this link" },
      { status: 403 },
    );
  }

  await withAuditContext(ctx, async (tx) => {
    await tx.delete(workItemLink).where(eq(workItemLink.id, linkId));
  });

  return Response.json({ data: { id: linkId, deleted: true } });
});
