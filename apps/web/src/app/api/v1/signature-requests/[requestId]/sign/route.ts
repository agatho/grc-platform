// W21-DMS-MULTISIGN-01: Sign a document signature request.
//
// Guards (enforced by the provider, mapped to HTTP here):
//   403 — caller is not a signer of this request
//   409 — request not pending / already decided / sequential order
//         violation / concurrent chain append (23505 on the partial
//         UNIQUE index from migration 0375)
//   422 — document bytes changed after the request froze the file hash
//
// The signature is a simple electronic signature (Art. 25 eIDAS) —
// SHA-256 hash-chain link over documentId + versionId + fileSha256 +
// signerUserId + signedAt + decision, plus IP and user agent capture.

import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import {
  getSignatureProvider,
  signatureErrorResponse,
} from "@/lib/documents/signature-provider";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { requestId } = await params;

  const ipHeader =
    req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");
  const ipAddress = ipHeader
    ? ipHeader.split(",")[0].trim().slice(0, 64)
    : null;
  const userAgent = req.headers.get("user-agent")?.slice(0, 1000) ?? null;

  try {
    const result = await getSignatureProvider().sign({
      ctx,
      requestId,
      ipAddress,
      userAgent,
    });
    return Response.json({ data: result }, { status: 201 });
  } catch (err) {
    const mapped = signatureErrorResponse(err);
    if (mapped) return mapped;
    throw err;
  }
}
