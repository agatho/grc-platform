import {
  db,
  evidence,
  user,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// GET /api/v1/evidence/:id — Evidence detail
export async function GET(
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
}

// DELETE /api/v1/evidence/:id — Soft delete
export async function DELETE(
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
}
