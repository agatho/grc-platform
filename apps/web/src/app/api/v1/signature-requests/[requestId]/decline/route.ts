// W21-DMS-MULTISIGN-01: Decline a document signature request.
//
// A mandatory reason is required. The decline is chain-linked like a
// signature (decision = 'declined') and moves the whole request to
// status 'declined'; the creator is notified.

import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { resolveClientIp } from "@/lib/documents/client-ip";
import {
  getSignatureProvider,
  signatureErrorResponse,
} from "@/lib/documents/signature-provider";
import { z } from "zod";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

const declineSchema = z.object({
  reason: z.string().min(3).max(2000),
});

export const POST = withErrorHandler(async function POST(
  req: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { requestId } = await params;

  const parsed = declineSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  // #S06-03: the left-most X-Forwarded-For entry is client-supplied.
  // resolveClientIp() takes the entry appended by the outermost proxy we
  // actually control (TRUSTED_PROXY_HOPS) and marks the value as
  // untrusted when the topology is not declared, instead of printing a
  // freely chosen address on the certificate as if it were evidence.
  const client = resolveClientIp(req);
  const ipAddress = client.ip;
  const userAgent = req.headers.get("user-agent")?.slice(0, 1000) ?? null;

  try {
    const signature = await getSignatureProvider().decline({
      ctx,
      requestId,
      reason: parsed.data.reason,
      ipAddress,
      ipTrusted: client.trusted,
      userAgent,
    });
    return Response.json({ data: signature }, { status: 201 });
  } catch (err) {
    const mapped = signatureErrorResponse(err);
    if (mapped) return mapped;
    throw err;
  }
});
