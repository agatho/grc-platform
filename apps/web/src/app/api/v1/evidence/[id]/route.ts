import { db, evidence, user } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/evidence/:id — Evidence detail
export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [row] = await db
    .select({
      id: evidence.id,
      orgId: evidence.orgId,
      entityType: evidence.entityType,
      entityId: evidence.entityId,
      category: evidence.category,
      fileName: evidence.fileName,
      filePath: evidence.filePath,
      fileSize: evidence.fileSize,
      mimeType: evidence.mimeType,
      description: evidence.description,
      uploadedBy: evidence.uploadedBy,
      uploaderName: user.name,
      uploaderEmail: user.email,
      createdAt: evidence.createdAt,
    })
    .from(evidence)
    .leftJoin(user, eq(evidence.uploadedBy, user.id))
    .where(
      and(
        eq(evidence.id, id),
        eq(evidence.orgId, ctx.orgId),
        isNull(evidence.deletedAt),
      ),
    );

  if (!row) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ data: row });
});
// DELETE /api/v1/evidence/:id — Soft delete
export const DELETE = withErrorHandler(async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const deleted = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(evidence)
      .set({
        deletedAt: new Date(),
        deletedBy: ctx.userId,
      })
      .where(
        and(
          eq(evidence.id, id),
          eq(evidence.orgId, ctx.orgId),
          isNull(evidence.deletedAt),
        ),
      )
      .returning({ id: evidence.id });

    return row;
  });

  if (!deleted) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ data: { id, deleted: true } });
});
