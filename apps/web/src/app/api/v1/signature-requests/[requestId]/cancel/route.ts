// W21-DMS-MULTISIGN-01: Cancel a pending signature request.
// Only the creator or an org admin may cancel; only while pending.

import {
  db,
  documentSignature,
  documentSignatureRequest,
  notification,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { and, eq } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { requestId } = await params;

  const [request] = await db
    .select()
    .from(documentSignatureRequest)
    .where(
      and(
        eq(documentSignatureRequest.id, requestId),
        eq(documentSignatureRequest.orgId, ctx.orgId),
      ),
    );
  if (!request) {
    return Response.json(
      { error: "Signature request not found" },
      { status: 404 },
    );
  }

  const isAdmin = !!ctx.session.user.roles?.some(
    (r) => r.orgId === ctx.orgId && r.role === "admin",
  );
  if (request.createdBy !== ctx.userId && !isAdmin) {
    return Response.json(
      { error: "Only the creator or an admin can cancel this request" },
      { status: 403 },
    );
  }

  if (request.status !== "pending") {
    return Response.json(
      { error: `Signature request is ${request.status}` },
      { status: 409 },
    );
  }

  const pendingSigners = await db
    .select({
      signerUserId: documentSignature.signerUserId,
    })
    .from(documentSignature)
    .where(
      and(
        eq(documentSignature.requestId, requestId),
        eq(documentSignature.orgId, ctx.orgId),
        eq(documentSignature.status, "pending"),
      ),
    );

  const updated = await withAuditContext(
    ctx,
    async (tx) => {
      const [row] = await tx
        .update(documentSignatureRequest)
        .set({
          status: "cancelled" as const,
          updatedAt: new Date(),
          updatedBy: ctx.userId,
        })
        .where(
          and(
            eq(documentSignatureRequest.id, requestId),
            eq(documentSignatureRequest.status, "pending"),
          ),
        )
        .returning();
      if (!row) return null;

      for (const signer of pendingSigners) {
        if (signer.signerUserId === ctx.userId) continue;
        await tx.insert(notification).values({
          userId: signer.signerUserId,
          orgId: ctx.orgId,
          type: "status_change",
          entityType: "document",
          entityId: request.documentId,
          title: `Signature request cancelled: ${request.title}`,
          message: `Signature request '${request.title}' was cancelled — no action needed.`,
          channel: "both",
          templateKey: "document_signature_cancelled",
          templateData: {
            documentId: request.documentId,
            requestId: request.id,
          },
          createdBy: ctx.userId,
        });
      }
      return row;
    },
    { actionDetail: "Signature request cancelled" },
  );

  if (!updated) {
    return Response.json(
      { error: "Signature request was updated concurrently" },
      { status: 409 },
    );
  }

  return Response.json({ data: updated });
}
