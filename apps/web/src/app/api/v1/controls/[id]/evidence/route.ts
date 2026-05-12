// #WAVE6-CROSS-02: evidence attachments for this control.
// evidence is polymorphic via (entityType, entityId).

import { db, evidence } from "@grc/db";
import { eq, and, isNull, desc } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";
import { requireUuidParam } from "@/lib/param-validation";

type IdCtx = { params: Promise<{ id: string }> };

export const GET = withErrorHandler<IdCtx>(async function GET(req, { params }) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  requireUuidParam(id);

  const rows = await db
    .select({
      id: evidence.id,
      category: evidence.category,
      fileName: evidence.fileName,
      fileSize: evidence.fileSize,
      mimeType: evidence.mimeType,
      description: evidence.description,
      uploadedBy: evidence.uploadedBy,
      createdAt: evidence.createdAt,
    })
    .from(evidence)
    .where(
      and(
        eq(evidence.orgId, ctx.orgId),
        eq(evidence.entityType, "control"),
        eq(evidence.entityId, id),
        isNull(evidence.deletedAt),
      ),
    )
    .orderBy(desc(evidence.createdAt));

  return Response.json({ data: rows, total: rows.length });
});
