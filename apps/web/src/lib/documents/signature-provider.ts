// Signature-provider abstraction for the document multi-signer
// e-signature workflow (W21-DMS-MULTISIGN-01).
//
// ── Why an interface? ───────────────────────────────────────────────
// The Wave-19 scope decision (docs/qa-reports/wave19-n7-dms-scope-decision.md)
// named two options: build in-house or integrate sproof / DocuSign.
// Decision 2026-07-11: in-house first (simple electronic signature as
// defined in Art. 3 no. 10 eIDAS, legal effect per Art. 25(1) eIDAS —
// no QES; #S06-20 corrected the citation: Art. 25 governs legal effect,
// it does not define a signature class). SHA-256 hash chain. It keeps the
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
import { writeAuditEntry } from "@/lib/audit-entry";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import {
  getFileStorage,
  orgScopedStorage,
  FileNotFoundInStorageError,
} from "@grc/shared/lib/file-storage";
import { withAuditContext, type ApiContext } from "@/lib/api";
import {
  buildSignatureLink,
  verifySignatureChain,
  CURRENT_SIGNATURE_HASH_VERSION,
  type SignatureChainRow,
  type SignatureDecision,
  type SignaturePayloadV2,
} from "./signature-chain";
import {
  timestampChainLink,
  type SignatureTsaStatus,
} from "./signature-timestamp";

// ─── Row types ──────────────────────────────────────────────────────

export type SignatureRequestRow = typeof documentSignatureRequest.$inferSelect;
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
  /**
   * #S06-03: whether `ipAddress` came from a position a client cannot
   * set. Stored with the row and printed on the certificate — an
   * unverifiable self-declared address must not look like evidence.
   */
  ipTrusted?: boolean;
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
  /** #S06-03: false/null → the IP is a client-supplied self-declaration. */
  ipTrusted: boolean | null;
  chainHash: string | null;
  /** Which content_hash formula this link uses (#S06-03). */
  hashVersion: number;
  /** #S06-05: RFC 3161 timestamp state for this link. */
  tsaStatus: SignatureTsaStatus | null;
  tsaGenTime: string | null;
  tsaSerial: string | null;
  /** null for pending slots (nothing to verify yet). */
  contentHashValid: boolean | null;
  chainLinkValid: boolean | null;
}

/**
 * #S06-04 — what the file-integrity statement is actually based on.
 *
 * The certificate printed "Datei-Integrität: UNVERÄNDERT" from a
 * comparison of two DATABASE COLUMNS (document_signature_request
 * .file_sha256 against document_version.file_sha256), both written by
 * the same code path at request creation. The bytes in the object store
 * were never read and never re-hashed on this path. Anyone swapping the
 * object without touching the database got "UNVERÄNDERT", a valid
 * chain, and the swapped bytes on download.
 *
 * verify() now reads the stored object and hashes it. The result is a
 * three-state value, because "we could not check" must not be reported
 * as "unchanged":
 *   verified_unchanged — bytes re-hashed, match the frozen hash
 *   verified_changed   — bytes re-hashed, differ
 *   unverifiable       — no file path, or the object is missing/unreadable
 */
export type FileIntegrityState =
  "verified_unchanged" | "verified_changed" | "unverifiable";

export interface SignatureVerificationReport {
  requestId: string;
  documentId: string;
  documentTitle: string | null;
  versionId: string;
  versionLabel: string | null;
  requestStatus: SignatureRequestRow["status"];
  /** Hash frozen at request creation. */
  frozenFileSha256: string;
  /** Hash recorded in the DB for the signed version (metadata only). */
  currentFileSha256: string | null;
  /** #S06-04: SHA-256 actually recomputed from the stored bytes. */
  recomputedFileSha256: string | null;
  /** #S06-04: three-state — never "unchanged" when nothing was read. */
  fileIntegrity: FileIntegrityState;
  /** Reason when fileIntegrity === "unverifiable". */
  fileIntegrityNote: string | null;
  /** When the bytes were read and hashed (null when unverifiable). */
  fileCheckedAt: string | null;
  /** Kept for API compatibility: true only for verified_unchanged. */
  fileIntegrityValid: boolean;
  chainValid: boolean;
  /** Chronological index of the first broken link, or null. */
  brokenAt: number | null;
  /** #S06-15: completeness defects (truncated tail, missing slots …). */
  chainDefects: string[];
  /** #S06-13: requester of the ceremony, and whether they also signed. */
  requestedByUserId: string | null;
  requestedByName: string | null;
  creatorIsSigner: boolean;
  /** #S06-05: how many decided links carry a granted RFC 3161 token. */
  timestampedLinks: number;
  /** Overall verdict: chain intact AND file verified unchanged. */
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

/** Live file hash of the frozen version (fallback: document inline hash).
 *  This is a METADATA read — see recomputeVersionFileSha for the real
 *  check (#S06-04). Kept for the cheap pre-flight in sign()/decline(),
 *  which is followed by the byte-level check below. */
async function loadLiveFileSha(versionId: string): Promise<string | null> {
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

export interface RecomputedFileHash {
  sha256: string | null;
  /** Why no hash could be produced (null when one was). */
  note: string | null;
  checkedAt: Date | null;
}

/**
 * #S06-04 — read the bytes of the signed version from the object store
 * and hash them. This is the check the certificate always claimed to
 * have made.
 *
 * The version's own file_path is authoritative; the document head
 * (document.file_path) is only a fallback for rows predating D4, and it
 * is explicitly flagged as such, because the head can point at a
 * different file than the signed version.
 */
async function recomputeVersionFileSha(
  versionId: string,
  orgId: string,
): Promise<RecomputedFileHash> {
  const [row] = await db
    .select({
      versionPath: documentVersion.filePath,
      docPath: document.filePath,
    })
    .from(documentVersion)
    .leftJoin(document, eq(document.id, documentVersion.documentId))
    .where(
      and(eq(documentVersion.id, versionId), eq(documentVersion.orgId, orgId)),
    );

  if (!row) {
    return {
      sha256: null,
      note: "signed version row not found",
      checkedAt: null,
    };
  }
  const path = row.versionPath ?? row.docPath ?? null;
  if (!path) {
    return {
      sha256: null,
      note: "no file is attached to the signed version",
      checkedAt: null,
    };
  }
  const usedHead = row.versionPath === null;
  try {
    // #S06-10: the key must belong to this tenant.
    const buffer = await orgScopedStorage(getFileStorage(), orgId).get(path);
    return {
      sha256: createHash("sha256").update(buffer).digest("hex"),
      note: usedHead
        ? "hashed the document head file — the version carries no own file path"
        : null,
      checkedAt: new Date(),
    };
  } catch (err) {
    if (err instanceof FileNotFoundInStorageError) {
      return {
        sha256: null,
        note: `object missing in storage (${path})`,
        checkedAt: null,
      };
    }
    return {
      sha256: null,
      note: `object could not be read (${err instanceof Error ? err.message : String(err)})`,
      checkedAt: null,
    };
  }
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

    // ── #S06-13 (ARCTOS-FULL-2026-08-31, Medium) ──────────────────
    // createRequest checked for duplicate signers, org membership and a
    // signable file — but never against ctx.userId or document.created_by.
    // A process_owner could create the document, upload the file, open a
    // request with HIMSELF as the only signer and sign it. The result is
    // a certificate reading "Gesamtergebnis: GÜLTIG" that an external
    // reviewer cannot tell apart from an independent attestation: the
    // PDF listed signer, time, IP and chain hash, but not the requester.
    //
    // A one-signer ceremony where the requester is that signer is
    // self-attestation and is refused. Being one of SEVERAL signers stays
    // allowed (a document owner co-signing is legitimate) but is recorded
    // in creator_is_signer and printed on the certificate.
    const creatorIsSigner = signerUserIds.includes(ctx.userId);
    if (creatorIsSigner && signerUserIds.length === 1) {
      throw new SignatureWorkflowError(
        "validation",
        "Segregation of duties: the requester of a signature ceremony must not be its only signer. Add at least one other signer, or have someone else open the request.",
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
            // #S06-15: the expected shape of the chain, recorded up front.
            signatureCount: signerUserIds.length,
            chainLength: 0,
            finalChainHash: null,
            // #S06-13
            creatorIsSigner,
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
      {
        actionDetail: `Signature request created (${signerUserIds.length} signers)`,
      },
    );
  }

  /**
   * #S06-23 — end a ceremony that can no longer complete.
   *
   * Previously the request stayed `pending` after the frozen file
   * changed: `GET /documents/my-pending-signatures` kept listing it,
   * the due-date reminder cron kept nagging, and only a click on
   * "Signieren" revealed the 422. The creator was never told at all.
   */
  private async invalidate(
    ctx: ApiContext,
    req: SignatureRequestRow,
    signatures: SignatureRow[],
    reason: string,
  ): Promise<void> {
    if (req.status !== "pending") return;
    const notifyIds = new Set<string>();
    for (const sig of signatures) {
      if (sig.status === "pending" && sig.signerUserId !== ctx.userId) {
        notifyIds.add(sig.signerUserId);
      }
    }
    if (req.createdBy && req.createdBy !== ctx.userId) {
      notifyIds.add(req.createdBy);
    }

    await withAuditContext(
      ctx,
      async (tx) => {
        await tx
          .update(documentSignatureRequest)
          .set({
            status: "invalidated" as const,
            invalidatedAt: new Date(),
            invalidatedReason: reason,
            updatedAt: new Date(),
            updatedBy: ctx.userId,
          })
          .where(
            and(
              eq(documentSignatureRequest.id, req.id),
              eq(documentSignatureRequest.status, "pending"),
            ),
          );

        for (const userId of notifyIds) {
          await tx.insert(notification).values({
            userId,
            orgId: ctx.orgId,
            type: "status_change",
            entityType: "document",
            entityId: req.documentId,
            title: `Signature request invalidated: ${req.title}`,
            message: `The document changed after the signature request was created, so '${req.title}' can no longer be signed. ${reason}`,
            channel: "both",
            templateKey: "document_signature_declined",
            templateData: {
              documentId: req.documentId,
              requestId: req.id,
              reason,
            },
            createdBy: ctx.userId,
          });
        }
      },
      { actionDetail: "signature_request_invalidated", reason },
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

    // Integrity: the file must still match the hash frozen at request
    // time — checked against the metadata AND against the actual bytes
    // (#S06-04: comparing two DB columns is not a file check).
    const liveSha = await loadLiveFileSha(req.versionId);
    const recomputed = await recomputeVersionFileSha(req.versionId, ctx.orgId);
    const bytesMatch =
      recomputed.sha256 === null ? null : recomputed.sha256 === req.fileSha256;
    if (liveSha !== req.fileSha256 || bytesMatch === false) {
      // #S06-23: the request used to stay `pending` forever after this.
      // Every later signer saw a normal-looking task, the reminder cron
      // kept chasing it, and the creator was never told the ceremony was
      // dead. It gets an explicit end state and a notification now.
      await this.invalidate(
        ctx,
        req,
        signatures,
        liveSha !== req.fileSha256
          ? `Recorded file hash changed (frozen ${req.fileSha256.slice(0, 12)}…, now ${liveSha?.slice(0, 12) ?? "none"}…)`
          : `Stored bytes no longer hash to the frozen value (${recomputed.sha256?.slice(0, 12)}…)`,
      );
      throw new SignatureWorkflowError(
        "integrity",
        "The document was modified after the signature request was created — the request has been invalidated",
        {
          frozenFileSha256: req.fileSha256,
          currentFileSha256: liveSha,
          recomputedFileSha256: recomputed.sha256,
        },
      );
    }
    if (recomputed.sha256 === null) {
      throw new SignatureWorkflowError(
        "integrity",
        `The signed file cannot be read from storage, so its integrity cannot be established: ${recomputed.note ?? "unknown reason"}`,
        { frozenFileSha256: req.fileSha256 },
      );
    }

    const signedAtIso = new Date().toISOString();
    // #S06-03: hash version 2 binds ip, user agent, decline reason and
    // sign order — the fields the signing dialog promises to record.
    const payload: SignaturePayloadV2 = {
      documentId: req.documentId,
      versionId: req.versionId,
      fileSha256: req.fileSha256,
      signerUserId: ctx.userId,
      signedAt: signedAtIso,
      decision: "signed",
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      declineReason: null,
      signOrder: mine.signOrder,
    };
    const link = buildSignatureLink(
      chainHead(signatures),
      payload,
      CURRENT_SIGNATURE_HASH_VERSION,
    );

    // #S06-05: anchor the link with an RFC 3161 token BEFORE writing it,
    // so a granted token is stored with the row it attests. Best-effort
    // — the outcome (granted / unavailable / disabled / error) is stored
    // and reported rather than assumed.
    const tsa = await timestampChainLink(link.chainHash);

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
              hashVersion: link.hashVersion,
              ipAddress: input.ipAddress,
              ipTrusted: input.ipTrusted ?? false,
              userAgent: input.userAgent,
              tsaStatus: tsa.status,
              tsaGenTime: tsa.genTime,
              tsaSerial: tsa.serialNumber,
              tsaPolicyOid: tsa.policyOid,
              tsaProof: tsa.proof,
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

          // #S06-15: record the expected chain head and length so a
          // later truncation at the END becomes detectable.
          await tx
            .update(documentSignatureRequest)
            .set({
              chainLength: sql`${documentSignatureRequest.chainLength} + 1`,
              finalChainHash: link.chainHash,
            })
            .where(eq(documentSignatureRequest.id, req.id));

          // #S06-05: bind the chain link into the anchored audit trail.
          // Even without a TSA token the link then hangs off the
          // FreeTSA-anchored audit_log chain (ADR-011 rev.4) instead of
          // standing alone on an app-server clock.
          await writeAuditEntry(tx, {
            orgId: ctx.orgId,
            userId: ctx.userId,
            userEmail: ctx.session.user.email,
            userName: ctx.session.user.name,
            entityType: "document_signature",
            entityId: updated.id,
            entityTitle: req.title,
            action: "create",
            actionDetail: "signature_chain_anchor",
            metadata: {
              requestId: req.id,
              documentId: req.documentId,
              versionId: req.versionId,
              decision: "signed",
              signOrder: mine.signOrder,
              chainHash: link.chainHash,
              previousChainHash: link.previousChainHash,
              contentHash: link.contentHash,
              hashVersion: link.hashVersion,
              signedAt: signedAtIso,
              fileSha256: req.fileSha256,
              recomputedFileSha256: recomputed.sha256,
              ipAddress: input.ipAddress,
              ipTrusted: input.ipTrusted ?? false,
              tsaStatus: tsa.status,
              tsaGenTime: tsa.genTime?.toISOString() ?? null,
              tsaSerial: tsa.serialNumber,
            },
          });

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
        {
          actionDetail: `Document signed (chain ${link.chainHash.slice(0, 12)}…)`,
        },
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
    // #S06-03: v2 payload — the decline REASON is now inside the hash.
    // It used to sit outside it, so it could be rewritten afterwards
    // without breaking the chain.
    const payload: SignaturePayloadV2 = {
      documentId: req.documentId,
      versionId: req.versionId,
      fileSha256: req.fileSha256,
      signerUserId: ctx.userId,
      signedAt: signedAtIso,
      decision: "declined",
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      declineReason: input.reason,
      signOrder: mine.signOrder,
    };
    const link = buildSignatureLink(
      chainHead(signatures),
      payload,
      CURRENT_SIGNATURE_HASH_VERSION,
    );
    const tsa = await timestampChainLink(link.chainHash);

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
              hashVersion: link.hashVersion,
              ipAddress: input.ipAddress,
              ipTrusted: input.ipTrusted ?? false,
              userAgent: input.userAgent,
              tsaStatus: tsa.status,
              tsaGenTime: tsa.genTime,
              tsaSerial: tsa.serialNumber,
              tsaPolicyOid: tsa.policyOid,
              tsaProof: tsa.proof,
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
              // #S06-15
              chainLength: sql`${documentSignatureRequest.chainLength} + 1`,
              finalChainHash: link.chainHash,
              updatedAt: new Date(),
              updatedBy: ctx.userId,
            })
            .where(eq(documentSignatureRequest.id, req.id));

          // #S06-05: anchor the decline link in the audit chain too.
          await writeAuditEntry(tx, {
            orgId: ctx.orgId,
            userId: ctx.userId,
            userEmail: ctx.session.user.email,
            userName: ctx.session.user.name,
            entityType: "document_signature",
            entityId: updated.id,
            entityTitle: req.title,
            action: "create",
            actionDetail: "signature_chain_anchor",
            metadata: {
              requestId: req.id,
              documentId: req.documentId,
              versionId: req.versionId,
              decision: "declined",
              signOrder: mine.signOrder,
              chainHash: link.chainHash,
              previousChainHash: link.previousChainHash,
              contentHash: link.contentHash,
              hashVersion: link.hashVersion,
              signedAt: signedAtIso,
              ipAddress: input.ipAddress,
              ipTrusted: input.ipTrusted ?? false,
              tsaStatus: tsa.status,
              tsaGenTime: tsa.genTime?.toISOString() ?? null,
              tsaSerial: tsa.serialNumber,
            },
          });

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

    const [requester] = req.createdBy
      ? await db
          .select({ name: user.name })
          .from(user)
          .where(eq(user.id, req.createdBy))
      : [];

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
      hashVersion: r.sig.hashVersion ?? 1,
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
        // v2 fields — ignored by computeContentHash for hashVersion 1.
        ipAddress: r.sig.ipAddress ?? null,
        userAgent: r.sig.userAgent ?? null,
        declineReason: r.sig.declineReason ?? null,
        signOrder: r.sig.signOrder,
      },
    }));

    // #S06-15: hand the recorded shape to the verifier so a truncation
    // at the END of the chain is detected. A forward-only walk cannot
    // see it — every prefix of a valid chain is a valid chain.
    const chainResult = verifySignatureChain(chainRows, {
      expectedLength: req.chainLength ?? null,
      expectedFinalChainHash: req.finalChainHash ?? null,
      expectedSlotCount: req.signatureCount ?? null,
      actualSlotCount: sigRows.length,
    });

    const verificationBySigId = new Map<
      string,
      { contentHashValid: boolean; chainLinkValid: boolean }
    >();
    decided.forEach((r, i) => {
      verificationBySigId.set(r.sig.id, chainResult.links[i]);
    });

    // ── #S06-04: the file check that the certificate always claimed ──
    // The recorded column value is kept for the report (it shows what
    // the DB believes), but the VERDICT comes from re-hashing the bytes
    // in the object store.
    const currentFileSha256 = row.versionSha ?? row.docSha ?? null;
    const recomputed = await recomputeVersionFileSha(req.versionId, ctx.orgId);
    let fileIntegrity: FileIntegrityState;
    let fileIntegrityNote: string | null = recomputed.note;
    if (recomputed.sha256 === null) {
      fileIntegrity = "unverifiable";
      fileIntegrityNote =
        recomputed.note ?? "the stored file could not be read";
    } else if (recomputed.sha256 === req.fileSha256) {
      fileIntegrity = "verified_unchanged";
    } else {
      fileIntegrity = "verified_changed";
      fileIntegrityNote =
        recomputed.note ??
        "the stored bytes do not hash to the value frozen at request time";
    }
    const fileIntegrityValid = fileIntegrity === "verified_unchanged";

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
        ipTrusted: r.sig.ipTrusted ?? null,
        chainHash: r.sig.chainHash ?? null,
        hashVersion: r.sig.hashVersion ?? 1,
        tsaStatus: (r.sig.tsaStatus as SignatureTsaStatus | null) ?? null,
        tsaGenTime: r.sig.tsaGenTime
          ? new Date(r.sig.tsaGenTime as unknown as string | Date).toISOString()
          : null,
        tsaSerial: r.sig.tsaSerial ?? null,
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
      recomputedFileSha256: recomputed.sha256,
      fileIntegrity,
      fileIntegrityNote,
      fileCheckedAt: recomputed.checkedAt?.toISOString() ?? null,
      fileIntegrityValid,
      chainValid: chainResult.ok,
      brokenAt: chainResult.brokenAt,
      chainDefects: chainResult.defects,
      requestedByUserId: req.createdBy ?? null,
      requestedByName: requester?.name ?? null,
      creatorIsSigner: req.creatorIsSigner ?? false,
      timestampedLinks: decided.filter((r) => r.sig.tsaStatus === "granted")
        .length,
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
