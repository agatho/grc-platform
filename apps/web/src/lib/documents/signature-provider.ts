// Signature-provider abstraction for the document multi-signer
// e-signature workflow (W21-DMS-MULTISIGN-01).
//
// ── Why an interface? ───────────────────────────────────────────────
// The Wave-19 scope decision (docs/qa-reports/wave19-n7-dms-scope-decision.md)
// named two options: build in-house or integrate sproof / DocuSign.
// Decision 2026-07-11: in-house first (simple electronic signature per
// Art. 25 eIDAS, SHA-256 hash chain — no QES). This module keeps the
// door open for the vendor route: a SproofSignatureProvider /
// DocuSignSignatureProvider implementing `SignatureProvider` can be
// registered in `getSignatureProvider()` below and selected via the
// `SIGNATURE_PROVIDER` env var without touching any API route.
//
// The in-house provider owns the workflow logic (freeze version + file
// hash, ordered signer slots, sequential enforcement, hash-chain append,
// notifications) and throws typed `SignatureWorkflowError`s which the
// routes map to HTTP statuses via `signatureErrorResponse()`.

import {
  db,
  document,
  documentVersion,
  documentSignature,
  documentSignatureRequest,
  notification,
  user,
  userOrganizationRole,
} from "@grc/db";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { withAuditContext, type ApiContext } from "@/lib/api";
import {
  buildSignatureLink,
  verifySignatureChain,
  type SignatureChainRow,
  type SignatureDecision,
} from "./signature-chain";

// ─── Row types ──────────────────────────────────────────────────────

export type SignatureRequestRow =
  typeof documentSignatureRequest.$inferSelect;
export type SignatureRow = typeof documentSignature.$inferSelect;

// ─── Errors ─────────────────────────────────────────────────────────

export type SignatureWorkflowErrorCode =
  | "not_found" // 404 — request/document not visible in this org
  | "forbidden" // 403 — caller is not the responsible signer / creator
  | "conflict" // 409 — wrong state, not your turn, concurrent append
  | "integrity" // 422 — document bytes changed after the request froze them
  | "validation"; // 422 — invalid input (no file, unknown signer, …)

export class SignatureWorkflowError extends Error {
  readonly code: SignatureWorkflowErrorCode;
  readonly details?: unknown;
  constructor(
    code: SignatureWorkflowErrorCode,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "SignatureWorkflowError";
    this.code = code;
    this.details = details;
  }
}

const ERROR_STATUS: Record<SignatureWorkflowErrorCode, number> = {
  not_found: 404,
  forbidden: 403,
  conflict: 409,
  integrity: 422,
  validation: 422,
};

/** Maps SignatureWorkflowError to a JSON Response; null for other errors. */
export function signatureErrorResponse(err: unknown): Response | null {
  if (err instanceof SignatureWorkflowError) {
    return Response.json(
      { error: err.message, code: err.code, details: err.details },
      { status: ERROR_STATUS[err.code] },
    );
  }
  return null;
}

// ─── Provider contract ──────────────────────────────────────────────

export interface CreateSignatureRequestInput {
  ctx: ApiContext;
  documentId: string;
  /** Defaults to the document title. */
  title?: string;
  message?: string | null;
  sequential: boolean;
  dueDate?: string | null;
  /** Ordered — index defines sign_order (1-based). */
  signerUserIds: string[];
}

export interface SignatureActionInput {
  ctx: ApiContext;
  requestId: string;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface DeclineInput extends SignatureActionInput {
  reason: string;
}

export interface SignResult {
  signature: SignatureRow;
  requestCompleted: boolean;
}

export interface SignatureVerificationLink {
  signatureId: string;
  signerUserId: string;
  signerName: string | null;
  signOrder: number;
  status: SignatureRow["status"];
  signedAt: string | null;
  ipAddress: string | null;
  chainHash: string | null;
  /** null for pending slots (nothing to verify yet). */
  contentHashValid: boolean | null;
  chainLinkValid: boolean | null;
}

export interface SignatureVerificationReport {
  requestId: string;
  documentId: string;
  documentTitle: string | null;
  versionId: string;
  versionLabel: string | null;
  requestStatus: SignatureRequestRow["status"];
  /** Hash frozen at request creation. */
  frozenFileSha256: string;
  /** Live hash of the signed version (null if the file row vanished). */
  currentFileSha256: string | null;
  fileIntegrityValid: boolean;
  chainValid: boolean;
  /** Chronological index of the first broken link, or null. */
  brokenAt: number | null;
  /** Overall verdict: chain intact AND file unchanged. */
  valid: boolean;
  links: SignatureVerificationLink[];
}

export interface SignatureProvider {
  createRequest(input: CreateSignatureRequestInput): Promise<{
    request: SignatureRequestRow;
    signatures: SignatureRow[];
  }>;
  sign(input: SignatureActionInput): Promise<SignResult>;
  decline(input: DeclineInput): Promise<SignatureRow>;
  verify(
    ctx: ApiContext,
    requestId: string,
  ): Promise<SignatureVerificationReport>;
}

// ─── In-house implementation ────────────────────────────────────────

async function loadRequest(
  ctx: ApiContext,
  requestId: string,
): Promise<SignatureRequestRow> {
  const [req] = await db
    .select()
    .from(documentSignatureRequest)
    .where(
      and(
        eq(documentSignatureRequest.id, requestId),
        eq(documentSignatureRequest.orgId, ctx.orgId),
      ),
    );
  if (!req) {
    throw new SignatureWorkflowError(
      "not_found",
      "Signature request not found",
    );
  }
  return req;
}

async function loadSignatures(
  ctx: ApiContext,
  requestId: string,
): Promise<SignatureRow[]> {
  return db
    .select()
    .from(documentSignature)
    .where(
      and(
        eq(documentSignature.requestId, requestId),
        eq(documentSignature.orgId, ctx.orgId),
      ),
    )
    .orderBy(asc(documentSignature.signOrder));
}

/** Live file hash of the frozen version (fallback: document inline hash). */
async function loadLiveFileSha(
  versionId: string,
): Promise<string | null> {
  const [row] = await db
    .select({
      versionSha: documentVersion.fileSha256,
      docSha: document.fileSha256,
    })
    .from(documentVersion)
    .leftJoin(document, eq(document.id, documentVersion.documentId))
    .where(eq(documentVersion.id, versionId));
  return row ? (row.versionSha ?? row.docSha ?? null) : null;
}

/** Chain head: chain_hash of the latest decided link (chronological). */
function chainHead(signatures: SignatureRow[]): string | null {
  const decided = signatures
    .filter((s) => s.chainHash !== null && s.signedAt !== null)
    .sort(
      (a, b) =>
        new Date(a.signedAt as unknown as string | Date).getTime() -
        new Date(b.signedAt as unknown as string | Date).getTime(),
    );
  return decided.length > 0 ? decided[decided.length - 1].chainHash : null;
}

function findOwnPendingSlot(
  ctx: ApiContext,
  req: SignatureRequestRow,
  signatures: SignatureRow[],
): SignatureRow {
  if (req.status !== "pending") {
    throw new SignatureWorkflowError(
      "conflict",
      `Signature request is ${req.status}`,
    );
  }
  const mine = signatures.find((s) => s.signerUserId === ctx.userId);
  if (!mine) {
    throw new SignatureWorkflowError(
      "forbidden",
      "You are not a signer of this request",
    );
  }
  if (mine.status !== "pending") {
    throw new SignatureWorkflowError(
      "conflict",
      `You already ${mine.status} this request`,
    );
  }
  return mine;
}

class InHouseSignatureProvider implements SignatureProvider {
  async createRequest(input: CreateSignatureRequestInput): Promise<{
    request: SignatureRequestRow;
    signatures: SignatureRow[];
  }> {
    const { ctx, documentId, signerUserIds } = input;

    const uniqueSigners = new Set(signerUserIds);
    if (uniqueSigners.size !== signerUserIds.length) {
      throw new SignatureWorkflowError(
        "validation",
        "Duplicate signers are not allowed",
      );
    }

    const [doc] = await db
      .select({
        id: document.id,
        title: document.title,
        fileSha256: document.fileSha256,
      })
      .from(document)
      .where(
        and(
          eq(document.id, documentId),
          eq(document.orgId, ctx.orgId),
          isNull(document.deletedAt),
        ),
      );
    if (!doc) {
      throw new SignatureWorkflowError("not_found", "Document not found");
    }

    // Freeze the current version + its file hash.
    const [version] = await db
      .select({
        id: documentVersion.id,
        fileSha256: documentVersion.fileSha256,
      })
      .from(documentVersion)
      .where(
        and(
          eq(documentVersion.documentId, documentId),
          eq(documentVersion.orgId, ctx.orgId),
          eq(documentVersion.isCurrent, true),
        ),
      );
    const frozenSha = version?.fileSha256 ?? doc.fileSha256 ?? null;
    if (!version || !frozenSha) {
      throw new SignatureWorkflowError(
        "validation",
        "Document has no signable file (a current version with a file hash is required)",
      );
    }

    // All signers must belong to this org (pattern: approval-steps route).
    const memberRows = await db
      .select({ userId: userOrganizationRole.userId })
      .from(userOrganizationRole)
      .where(
        and(
          inArray(userOrganizationRole.userId, signerUserIds),
          eq(userOrganizationRole.orgId, ctx.orgId),
          isNull(userOrganizationRole.deletedAt),
        ),
      );
    const memberIds = new Set(memberRows.map((r) => r.userId));
    const missing = signerUserIds.filter((id) => !memberIds.has(id));
    if (missing.length > 0) {
      throw new SignatureWorkflowError(
        "validation",
        "Signer not found in this organization",
        missing,
      );
    }

    return withAuditContext(
      ctx,
      async (tx) => {
        const [request] = (await tx
          .insert(documentSignatureRequest)
          .values({
            orgId: ctx.orgId,
            documentId,
            versionId: version.id,
            fileSha256: frozenSha,
            title: input.title?.trim() || doc.title,
            message: input.message ?? null,
            sequential: input.sequential,
            dueDate: input.dueDate ? new Date(input.dueDate) : null,
            createdBy: ctx.userId,
            updatedBy: ctx.userId,
          })
          .returning()) as SignatureRequestRow[];

        const signatures = (await tx
          .insert(documentSignature)
          .values(
            signerUserIds.map((signerUserId, idx) => ({
              orgId: ctx.orgId,
              requestId: request.id,
              signerUserId,
              signOrder: idx + 1,
              status: "pending" as const,
              createdBy: ctx.userId,
              updatedBy: ctx.userId,
            })),
          )
          .returning()) as SignatureRow[];

        // Sequential: only the first signer is up; parallel: everyone.
        const toNotify = input.sequential ? signatures.slice(0, 1) : signatures;
        for (const sig of toNotify) {
          if (sig.signerUserId === ctx.userId) continue;
          await tx.insert(notification).values({
            userId: sig.signerUserId,
            orgId: ctx.orgId,
            type: "approval_request",
            entityType: "document",
            entityId: documentId,
            title: `Signature requested: ${request.title}`,
            message: `You are requested to sign document '${request.title}' (signer ${sig.signOrder} of ${signatures.length}).`,
            channel: "both",
            templateKey: "document_signature_requested",
            templateData: {
              documentId,
              requestId: request.id,
              documentTitle: request.title,
              signOrder: sig.signOrder,
              dueDate: input.dueDate ?? null,
            },
            createdBy: ctx.userId,
          });
        }

        return { request, signatures };
      },
      { actionDetail: `Signature request created (${signerUserIds.length} signers)` },
    );
  }

  async sign(input: SignatureActionInput): Promise<SignResult> {
    const { ctx, requestId } = input;
    const req = await loadRequest(ctx, requestId);
    const signatures = await loadSignatures(ctx, requestId);
    const mine = findOwnPendingSlot(ctx, req, signatures);

    // Sequential enforcement: every earlier slot must already be signed.
    if (req.sequential) {
      const blocking = signatures.some(
        (s) => s.signOrder < mine.signOrder && s.status === "pending",
      );
      if (blocking) {
        throw new SignatureWorkflowError(
          "conflict",
          "It is not your turn yet — earlier signers are still pending",
        );
      }
    }

    // Integrity: the file must still match the hash frozen at request time.
    const liveSha = await loadLiveFileSha(req.versionId);
    if (liveSha !== req.fileSha256) {
      throw new SignatureWorkflowError(
        "integrity",
        "The document was modified after the signature request was created",
        { frozenFileSha256: req.fileSha256, currentFileSha256: liveSha },
      );
    }

    const signedAtIso = new Date().toISOString();
    const link = buildSignatureLink(chainHead(signatures), {
      documentId: req.documentId,
      versionId: req.versionId,
      fileSha256: req.fileSha256,
      signerUserId: ctx.userId,
      signedAt: signedAtIso,
      decision: "signed",
    });

    try {
      return await withAuditContext(
        ctx,
        async (tx) => {
          const [updated] = (await tx
            .update(documentSignature)
            .set({
              status: "signed" as const,
              signedAt: new Date(signedAtIso),
              contentHash: link.contentHash,
              previousChainHash: link.previousChainHash,
              chainHash: link.chainHash,
              ipAddress: input.ipAddress,
              userAgent: input.userAgent,
              updatedAt: new Date(),
              updatedBy: ctx.userId,
            })
            .where(
              and(
                eq(documentSignature.id, mine.id),
                eq(documentSignature.status, "pending"),
              ),
            )
            .returning()) as SignatureRow[];
          if (!updated) {
            throw new SignatureWorkflowError(
              "conflict",
              "Signature slot was updated concurrently",
            );
          }

          const remaining = signatures.filter(
            (s) => s.id !== mine.id && s.status === "pending",
          );
          const requestCompleted = remaining.length === 0;

          if (requestCompleted) {
            await tx
              .update(documentSignatureRequest)
              .set({
                status: "completed" as const,
                completedAt: new Date(),
                updatedAt: new Date(),
                updatedBy: ctx.userId,
              })
              .where(eq(documentSignatureRequest.id, req.id));
            if (req.createdBy && req.createdBy !== ctx.userId) {
              await tx.insert(notification).values({
                userId: req.createdBy,
                orgId: ctx.orgId,
                type: "status_change",
                entityType: "document",
                entityId: req.documentId,
                title: `All signatures collected: ${req.title}`,
                message: `Signature request '${req.title}' is complete — all signers have signed.`,
                channel: "both",
                templateKey: "document_signature_completed",
                templateData: { documentId: req.documentId, requestId: req.id },
                createdBy: ctx.userId,
              });
            }
          } else if (req.sequential) {
            const next = [...remaining].sort(
              (a, b) => a.signOrder - b.signOrder,
            )[0];
            await tx.insert(notification).values({
              userId: next.signerUserId,
              orgId: ctx.orgId,
              type: "approval_request",
              entityType: "document",
              entityId: req.documentId,
              title: `Your signature is next: ${req.title}`,
              message: `It is your turn to sign document '${req.title}' (signer ${next.signOrder}).`,
              channel: "both",
              templateKey: "document_signature_requested",
              templateData: {
                documentId: req.documentId,
                requestId: req.id,
                documentTitle: req.title,
                signOrder: next.signOrder,
              },
              createdBy: ctx.userId,
            });
          }

          return { signature: updated, requestCompleted };
        },
        { actionDetail: `Document signed (chain ${link.chainHash.slice(0, 12)}…)` },
      );
    } catch (err) {
      // Migration 0375: partial UNIQUE (request_id, previous_chain_hash)
      // NULLS NOT DISTINCT rejects concurrent appends to the same head.
      if ((err as { code?: string }).code === "23505") {
        throw new SignatureWorkflowError(
          "conflict",
          "Concurrent signature detected — chain head moved, retry",
        );
      }
      throw err;
    }
  }

  async decline(input: DeclineInput): Promise<SignatureRow> {
    const { ctx, requestId } = input;
    const req = await loadRequest(ctx, requestId);
    const signatures = await loadSignatures(ctx, requestId);
    const mine = findOwnPendingSlot(ctx, req, signatures);

    // A decline is chain-linked too (decision = 'declined') so the
    // certificate/verify report covers the full ceremony history.
    const signedAtIso = new Date().toISOString();
    const link = buildSignatureLink(chainHead(signatures), {
      documentId: req.documentId,
      versionId: req.versionId,
      fileSha256: req.fileSha256,
      signerUserId: ctx.userId,
      signedAt: signedAtIso,
      decision: "declined",
    });

    try {
      return await withAuditContext(
        ctx,
        async (tx) => {
          const [updated] = (await tx
            .update(documentSignature)
            .set({
              status: "declined" as const,
              signedAt: new Date(signedAtIso),
              declineReason: input.reason,
              contentHash: link.contentHash,
              previousChainHash: link.previousChainHash,
              chainHash: link.chainHash,
              ipAddress: input.ipAddress,
              userAgent: input.userAgent,
              updatedAt: new Date(),
              updatedBy: ctx.userId,
            })
            .where(
              and(
                eq(documentSignature.id, mine.id),
                eq(documentSignature.status, "pending"),
              ),
            )
            .returning()) as SignatureRow[];
          if (!updated) {
            throw new SignatureWorkflowError(
              "conflict",
              "Signature slot was updated concurrently",
            );
          }

          await tx
            .update(documentSignatureRequest)
            .set({
              status: "declined" as const,
              updatedAt: new Date(),
              updatedBy: ctx.userId,
            })
            .where(eq(documentSignatureRequest.id, req.id));

          if (req.createdBy && req.createdBy !== ctx.userId) {
            await tx.insert(notification).values({
              userId: req.createdBy,
              orgId: ctx.orgId,
              type: "status_change",
              entityType: "document",
              entityId: req.documentId,
              title: `Signature declined: ${req.title}`,
              message: `A signer declined signature request '${req.title}': ${input.reason}`,
              channel: "both",
              templateKey: "document_signature_declined",
              templateData: {
                documentId: req.documentId,
                requestId: req.id,
                reason: input.reason,
              },
              createdBy: ctx.userId,
            });
          }

          return updated;
        },
        { actionDetail: "Document signature declined", reason: input.reason },
      );
    } catch (err) {
      if ((err as { code?: string }).code === "23505") {
        throw new SignatureWorkflowError(
          "conflict",
          "Concurrent signature detected — chain head moved, retry",
        );
      }
      throw err;
    }
  }

  async verify(
    ctx: ApiContext,
    requestId: string,
  ): Promise<SignatureVerificationReport> {
    const [row] = await db
      .select({
        req: documentSignatureRequest,
        documentTitle: document.title,
        docSha: document.fileSha256,
        versionLabel: documentVersion.versionLabel,
        versionSha: documentVersion.fileSha256,
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
      throw new SignatureWorkflowError(
        "not_found",
        "Signature request not found",
      );
    }
    const req = row.req;

    const sigRows = await db
      .select({
        sig: documentSignature,
        signerName: user.name,
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

    // Chronological chain verification over the decided slots.
    const decided = sigRows
      .filter((r) => r.sig.chainHash !== null && r.sig.signedAt !== null)
      .sort(
        (a, b) =>
          new Date(a.sig.signedAt as unknown as string | Date).getTime() -
          new Date(b.sig.signedAt as unknown as string | Date).getTime(),
      );

    const chainRows: SignatureChainRow[] = decided.map((r) => ({
      contentHash: r.sig.contentHash ?? "",
      previousChainHash: r.sig.previousChainHash,
      chainHash: r.sig.chainHash ?? "",
      payload: {
        documentId: req.documentId,
        versionId: req.versionId,
        fileSha256: req.fileSha256,
        signerUserId: r.sig.signerUserId,
        signedAt: new Date(
          r.sig.signedAt as unknown as string | Date,
        ).toISOString(),
        decision: (r.sig.status === "signed"
          ? "signed"
          : "declined") as SignatureDecision,
      },
    }));
    const chainResult = verifySignatureChain(chainRows);

    const verificationBySigId = new Map<
      string,
      { contentHashValid: boolean; chainLinkValid: boolean }
    >();
    decided.forEach((r, i) => {
      verificationBySigId.set(r.sig.id, chainResult.links[i]);
    });

    const currentFileSha256 = row.versionSha ?? row.docSha ?? null;
    const fileIntegrityValid = currentFileSha256 === req.fileSha256;

    const links: SignatureVerificationLink[] = sigRows.map((r) => {
      const v = verificationBySigId.get(r.sig.id) ?? null;
      return {
        signatureId: r.sig.id,
        signerUserId: r.sig.signerUserId,
        signerName: r.signerName ?? null,
        signOrder: r.sig.signOrder,
        status: r.sig.status,
        signedAt: r.sig.signedAt
          ? new Date(r.sig.signedAt as unknown as string | Date).toISOString()
          : null,
        ipAddress: r.sig.ipAddress ?? null,
        chainHash: r.sig.chainHash ?? null,
        contentHashValid: v ? v.contentHashValid : null,
        chainLinkValid: v ? v.chainLinkValid : null,
      };
    });

    return {
      requestId: req.id,
      documentId: req.documentId,
      documentTitle: row.documentTitle ?? null,
      versionId: req.versionId,
      versionLabel: row.versionLabel ?? null,
      requestStatus: req.status,
      frozenFileSha256: req.fileSha256,
      currentFileSha256,
      fileIntegrityValid,
      chainValid: chainResult.ok,
      brokenAt: chainResult.brokenAt,
      valid: chainResult.ok && fileIntegrityValid,
      links,
    };
  }
}

// ─── Factory ────────────────────────────────────────────────────────

const inHouseProvider = new InHouseSignatureProvider();

/**
 * Provider selection via env `SIGNATURE_PROVIDER` (default: "inhouse").
 *
 * External e-signature vendors dock here: implement `SignatureProvider`
 * (e.g. SproofSignatureProvider using the sproof sign API, or
 * DocuSignSignatureProvider using envelopes + Connect webhooks) and add
 * a case below. Routes, UI and the certificate endpoint stay unchanged.
 */
export function getSignatureProvider(): SignatureProvider {
  const kind = (process.env.SIGNATURE_PROVIDER ?? "inhouse").toLowerCase();
  switch (kind) {
    case "inhouse":
      return inHouseProvider;
    // case "sproof":   return sproofProvider;   // future (W21 option B)
    // case "docusign": return docuSignProvider; // future (W21 option B)
    default:
      // Unknown value — fail safe to the in-house implementation rather
      // than breaking every signature route at runtime.
      return inHouseProvider;
  }
}

export { InHouseSignatureProvider };
