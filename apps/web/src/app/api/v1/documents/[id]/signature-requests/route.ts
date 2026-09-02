// W21-DMS-MULTISIGN-01: Multi-signer signature requests per document.
//
// POST — create a signing ceremony: freezes the current version + file
//        hash, creates ordered signer slots, notifies the first signer
//        (sequential) or all signers (parallel).
// GET  — list all signature requests of a document incl. signer status.

import {
  db,
  document,
  documentSignature,
  documentSignatureRequest,
  user,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import {
  getSignatureProvider,
  signatureErrorResponse,
} from "@/lib/documents/signature-provider";
import { z } from "zod";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

const createSignatureRequestSchema = z.object({
  // Ordered — index defines sign_order.
  signers: z.array(z.string().uuid()).min(1).max(20),
  sequential: z.boolean().default(false),
  title: z.string().min(1).max(500).optional(),
  message: z.string().max(4000).optional().nullable(),
  dueDate: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), {
      message: "dueDate must be a valid ISO 8601 date or datetime",
    })
    .optional()
    .nullable(),
});

export const POST = withErrorHandler(async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "control_owner",
    "dpo",
    "process_owner",
  );
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const parsed = createSignatureRequestSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  try {
    const result = await getSignatureProvider().createRequest({
      ctx,
      documentId: id,
      title: parsed.data.title,
      message: parsed.data.message ?? null,
      sequential: parsed.data.sequential,
      dueDate: parsed.data.dueDate ?? null,
      signerUserIds: parsed.data.signers,
    });
    return Response.json({ data: result }, { status: 201 });
  } catch (err) {
    const mapped = signatureErrorResponse(err);
    if (mapped) return mapped;
    throw err;
  }
});
export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [doc] = await db
    .select({ id: document.id })
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

  const requests = await db
    .select()
    .from(documentSignatureRequest)
    .where(
      and(
        eq(documentSignatureRequest.documentId, id),
        eq(documentSignatureRequest.orgId, ctx.orgId),
      ),
    )
    .orderBy(desc(documentSignatureRequest.createdAt));

  const requestIds = requests.map((r) => r.id);
  const signatureRows =
    requestIds.length > 0
      ? await db
          .select({
            id: documentSignature.id,
            requestId: documentSignature.requestId,
            signerUserId: documentSignature.signerUserId,
            signerName: user.name,
            signerEmail: user.email,
            signOrder: documentSignature.signOrder,
            status: documentSignature.status,
            signedAt: documentSignature.signedAt,
            declineReason: documentSignature.declineReason,
            chainHash: documentSignature.chainHash,
          })
          .from(documentSignature)
          .leftJoin(user, eq(user.id, documentSignature.signerUserId))
          .where(
            and(
              inArray(documentSignature.requestId, requestIds),
              eq(documentSignature.orgId, ctx.orgId),
            ),
          )
          .orderBy(asc(documentSignature.signOrder))
      : [];

  const data = requests.map((r) => ({
    ...r,
    signatures: signatureRows.filter((s) => s.requestId === r.id),
  }));

  return Response.json({ data });
});
