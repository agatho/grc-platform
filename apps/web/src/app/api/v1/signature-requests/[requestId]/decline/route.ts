// W21-DMS-MULTISIGN-01: Decline a document signature request.
//
// A mandatory reason is required. The decline is chain-linked like a
// signature (decision = 'declined') and moves the whole request to
// status 'declined'; the creator is notified.

import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import {
  getSignatureProvider,
  signatureErrorResponse,
} from "@/lib/documents/signature-provider";
import { z } from "zod";

const declineSchema = z.object({
  reason: z.string().min(3).max(2000),
});

export async function POST(
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

  const ipHeader =
    req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");
  const ipAddress = ipHeader
    ? ipHeader.split(",")[0].trim().slice(0, 64)
    : null;
  const userAgent = req.headers.get("user-agent")?.slice(0, 1000) ?? null;

  try {
    const signature = await getSignatureProvider().decline({
      ctx,
      requestId,
      reason: parsed.data.reason,
      ipAddress,
      userAgent,
    });
    return Response.json({ data: signature }, { status: 201 });
  } catch (err) {
    const mapped = signatureErrorResponse(err);
    if (mapped) return mapped;
    throw err;
  }
}
