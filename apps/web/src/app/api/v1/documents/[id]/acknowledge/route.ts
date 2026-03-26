import {
  db,
  document,
  acknowledgment,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/documents/:id/acknowledge — Record acknowledgment
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  // Verify document exists and requires acknowledgment
  const [doc] = await db
    .select()
    .from(document)
    .where(
      and(
        eq(document.id, id),
        eq(document.orgId, ctx.orgId),
        isNull(document.deletedAt),
      ),
    );

  if (!doc) {
    return Response.json({ error: "Document not found" }, { status: 404 });
  }

  if (!doc.requiresAcknowledgment) {
    return Response.json(
      { error: "This document does not require acknowledgment" },
      { status: 422 },
    );
  }

  if (doc.status !== "published") {
    return Response.json(
      { error: "Only published documents can be acknowledged" },
      { status: 422 },
    );
  }

  // Check if already acknowledged for the current version
  const [existing] = await db
    .select()
    .from(acknowledgment)
    .where(
      and(
        eq(acknowledgment.documentId, id),
        eq(acknowledgment.userId, ctx.userId),
        eq(acknowledgment.orgId, ctx.orgId),
      ),
    );

  if (existing && existing.versionAcknowledged >= doc.currentVersion) {
    return Response.json(
      { error: "Already acknowledged for the current version" },
      { status: 409 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    if (existing) {
      // Update existing acknowledgment with new version
      const [row] = await tx
        .update(acknowledgment)
        .set({
          versionAcknowledged: doc.currentVersion,
          acknowledgedAt: new Date(),
        })
        .where(eq(acknowledgment.id, existing.id))
        .returning();

      return row;
    }

    // Create new acknowledgment
    const [row] = await tx
      .insert(acknowledgment)
      .values({
        orgId: ctx.orgId,
        documentId: id,
        userId: ctx.userId,
        versionAcknowledged: doc.currentVersion,
      })
      .returning();

    return row;
  });

  return Response.json({ data: result }, { status: 201 });
}
