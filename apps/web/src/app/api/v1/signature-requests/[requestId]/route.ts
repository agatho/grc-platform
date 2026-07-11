// W21-DMS-MULTISIGN-01: Signature request detail (request + signer slots).

import {
  db,
  document,
  documentSignature,
  documentSignatureRequest,
  documentVersion,
  user,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { and, asc, eq } from "drizzle-orm";
import { withAuth } from "@/lib/api";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { requestId } = await params;

  const [row] = await db
    .select({
      request: documentSignatureRequest,
      documentTitle: document.title,
      versionLabel: documentVersion.versionLabel,
      versionNumber: documentVersion.versionNumber,
    })
    .from(documentSignatureRequest)
    .leftJoin(document, eq(document.id, documentSignatureRequest.documentId))
    .leftJoin(
      documentVersion,
      eq(documentVersion.id, documentSignatureRequest.versionId),
    )
    .where(
      and(
        eq(documentSignatureRequest.id, requestId),
        eq(documentSignatureRequest.orgId, ctx.orgId),
      ),
    );
  if (!row) {
    return Response.json(
      { error: "Signature request not found" },
      { status: 404 },
    );
  }

  const signatures = await db
    .select({
      id: documentSignature.id,
      signerUserId: documentSignature.signerUserId,
      signerName: user.name,
      signerEmail: user.email,
      signOrder: documentSignature.signOrder,
      status: documentSignature.status,
      signedAt: documentSignature.signedAt,
      declineReason: documentSignature.declineReason,
      contentHash: documentSignature.contentHash,
      previousChainHash: documentSignature.previousChainHash,
      chainHash: documentSignature.chainHash,
      ipAddress: documentSignature.ipAddress,
    })
    .from(documentSignature)
    .leftJoin(user, eq(user.id, documentSignature.signerUserId))
    .where(
      and(
        eq(documentSignature.requestId, requestId),
        eq(documentSignature.orgId, ctx.orgId),
      ),
    )
    .orderBy(asc(documentSignature.signOrder));

  return Response.json({
    data: {
      ...row.request,
      documentTitle: row.documentTitle,
      versionLabel: row.versionLabel,
      versionNumber: row.versionNumber,
      signatures,
    },
  });
}
