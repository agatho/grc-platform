// W21-DMS-MULTISIGN-01: Verify the signature hash chain + file integrity.
//
// Recomputes every chain link from the stored row fields (tamper
// detection on the rows themselves), checks previous_chain_hash
// continuity, and compares the frozen file_sha256 against the live
// hash of the signed version. Returns a per-link verification report.

import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import {
  getSignatureProvider,
  signatureErrorResponse,
} from "@/lib/documents/signature-provider";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { requestId } = await params;

  try {
    const report = await getSignatureProvider().verify(ctx, requestId);
    return Response.json({ data: report });
  } catch (err) {
    const mapped = signatureErrorResponse(err);
    if (mapped) return mapped;
    throw err;
  }
}
