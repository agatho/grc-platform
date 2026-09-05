// W21-DMS-MULTISIGN-01: Sign a document signature request.
//
// Guards (enforced by the provider, mapped to HTTP here):
//   403 — caller is not a signer of this request
//   409 — request not pending / already decided / sequential order
//         violation / concurrent chain append (23505 on the partial
//         UNIQUE index from migration 0375)
//   422 — document bytes changed after the request froze the file hash
//
// The signature is a simple electronic signature as defined in Art. 3
// no. 10 eIDAS (legal effect: Art. 25(1) eIDAS) — #S06-20 corrected the
// citation, Art. 25 does not define a signature class.
// SHA-256 hash-chain link (hash_version 2, #S06-03) over documentId +
// versionId + fileSha256 + signerUserId + signedAt + decision +
// ipAddress + userAgent + declineReason + signOrder, anchored with an
// RFC 3161 timestamp where the TSA is reachable (#S06-05).

import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { resolveClientIp } from "@/lib/documents/client-ip";
import {
  getSignatureProvider,
  signatureErrorResponse,
} from "@/lib/documents/signature-provider";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

export const POST = withErrorHandler(async function POST(
  req: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { requestId } = await params;

  // #S06-03: the left-most X-Forwarded-For entry is client-supplied.
  // resolveClientIp() takes the entry appended by the outermost proxy we
  // actually control (TRUSTED_PROXY_HOPS) and marks the value as
  // untrusted when the topology is not declared, instead of printing a
  // freely chosen address on the certificate as if it were evidence.
  const client = resolveClientIp(req);
  const ipAddress = client.ip;
  const userAgent = req.headers.get("user-agent")?.slice(0, 1000) ?? null;

  try {
    const result = await getSignatureProvider().sign({
      ctx,
      requestId,
      ipAddress,
      ipTrusted: client.trusted,
      userAgent,
    });
    return Response.json({ data: result }, { status: 201 });
  } catch (err) {
    const mapped = signatureErrorResponse(err);
    if (mapped) return mapped;
    throw err;
  }
});
