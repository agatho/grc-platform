import { db, process, processComment, userOrganizationRole } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// PUT /api/v1/processes/:id/comments/:commentId/resolve — Resolve comment
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id, commentId } = await params;

  // Check user has process_owner or admin role
  const [role] = await db
    .select({ role: userOrganizationRole.role })
    .from(userOrganizationRole)
    .where(
      and(
        eq(userOrganizationRole.userId, ctx.userId),
        eq(userOrganizationRole.orgId, ctx.orgId),
        isNull(userOrganizationRole.deletedAt),
      ),
    );

  const userRole = role?.role ?? "viewer";
  if (userRole !== "admin" && userRole !== "process_owner") {
    return Response.json(
      { error: "Only admin or process_owner can resolve comments" },
      { status: 403 },
    );
  }

  // Verify process exists
  const [proc] = await db
    .select({ id: process.id })
    .from(process)
    .where(
      and(
        eq(process.id, id),
        eq(process.orgId, ctx.orgId),
        isNull(process.deletedAt),
      ),
    );

  if (!proc) {
    return Response.json({ error: "Process not found" }, { status: 404 });
  }

  // Fetch comment
  const [existing] = await db
    .select({
      id: processComment.id,
      isResolved: processComment.isResolved,
    })
    .from(processComment)
    .where(
      and(
        eq(processComment.id, commentId),
        eq(processComment.processId, id),
        eq(processComment.orgId, ctx.orgId),
        isNull(processComment.deletedAt),
      ),
    );

  if (!existing) {
    return Response.json({ error: "Comment not found" }, { status: 404 });
  }

  if (existing.isResolved) {
    return Response.json(
      { error: "Comment is already resolved" },
      { status: 422 },
    );
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(processComment)
      .set({
        isResolved: true,
        resolvedAt: new Date(),
        resolvedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(processComment.id, commentId),
          eq(processComment.orgId, ctx.orgId),
        ),
      )
      .returning();
    return row;
  });

  return Response.json({ data: updated });
}
