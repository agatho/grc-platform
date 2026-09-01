import { db, document, documentVersion, documentFile, auditLog } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { getFileStorage, orgScopedStorage } from "@grc/shared/lib/file-storage";
import {
  scanBuffer,
  isClamAvFailClosed,
  isClamAvRequired,
  type ClamScanResult,
} from "@grc/shared/lib/clamav";
import { verifyUploadSignature } from "@grc/shared";
import { extractFileText } from "@/lib/documents/extract-text";
import { createDocumentVersion } from "@/lib/document-versioning";
import { checkPdfStampable } from "@/lib/documents/pdf-watermark";
import { contentMutableForStatus } from "@/lib/documents/download-policy";
import { randomUUID, createHash } from "crypto";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const ALLOWED_MIMES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "text/plain",
  "text/csv",
  "text/markdown",
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "application/json",
  "application/xml",
  "text/xml",
]);

/** Legacy Office binaries (.doc/.xls/.ppt) sniff as OLE2; map the
 *  sniffed container back onto the declared type when that type is one
 *  of the accepted legacy formats. */
const OLE2_DECLARED_MIMES = new Set([
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
]);

// POST /api/v1/documents/:id/upload — Upload file attachment.
//
// D3: computes SHA-256 over the file buffer for tamper evidence.
// D4: creates a document_file row (multi-file support); the legacy
// inline columns on document keep mirroring the newest upload.
// Storage goes through the FileStorage abstraction (local FS or S3,
// STORAGE_BACKEND env) — the stored key stays the historical
// {orgId}/{docId}/{uuid}-{filename} relative path.
//
// ── #S06-01 (ARCTOS-FULL-2026-08-31, High) ──────────────────────────
// This route used to overwrite document_version.file_* of the CURRENT
// version in place. On a published document that meant: the release
// record of v2.0 (valid_from, approval history, all acknowledgments)
// stayed, but a different file stood behind it — with no status check,
// no four-eyes, no new version, and no legal-hold check. The three
// writes also ran on the bare `db` handle, so the DB audit trigger
// recorded the hash swap with a NULL actor.
//
// Three changes close it:
//   1. Uploads are only accepted while the document is still mutable
//      (draft / in_review, see CONTENT_MUTABLE_STATUSES) and not under
//      legal hold. A released document must go back through the
//      lifecycle (`PUT /documents/:id/status`) to receive a new file.
//   2. A version snapshot that already carries a file is NEVER
//      rewritten. If the current version already has a file, the upload
//      creates a NEW minor version pinned to the new file — the same
//      rule `versions/[versionId]/restore` states ("History is never
//      overwritten"). Only an empty snapshot is filled in place.
//   3. All writes run inside ONE withAuditContext transaction, so
//      app.current_user_id is set and the audit trigger records WHO.
//
// #S04-06 / #S06-21: the MIME allowlist no longer trusts the client
// header alone — the magic bytes decide, and the sniffed type is what
// gets persisted and later served as Content-Type.
// #S06-06: a PDF that cannot be watermarked is rejected HERE, where the
// uploader still has the unprotected original.
// ClamAV: infected uploads are rejected with 422 + audit-log entry;
// scan errors follow CLAMAV_FAIL_CLOSED; in production a scanner that
// was never configured is refused rather than silently skipped.
// Best-effort text extraction feeds document.file_text → search_vector.
export async function POST(
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

  const [doc] = await db
    .select()
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

  // #S06-01 (a): released documents are frozen. Their bytes may only
  // change by going back through the lifecycle, where checkFourEyes
  // applies on the way out again.
  if (!contentMutableForStatus(doc.status)) {
    return Response.json(
      {
        error: `Document is '${doc.status}' — a released document must not receive a new file in place. Move it back to 'draft' via PUT /api/v1/documents/${id}/status first; the approve/publish transitions then re-apply the four-eyes check.`,
        code: "document_released",
        status: doc.status,
      },
      { status: 409 },
    );
  }

  // #S06-01 (b): legal hold blocked erasure but not overwriting.
  if (doc.legalHold) {
    return Response.json(
      {
        error: "Document is under legal hold — its files must not be replaced.",
        code: "legal_hold",
      },
      { status: 409 },
    );
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return Response.json(
      { error: "File too large (max 50MB)" },
      { status: 413 },
    );
  }

  if (!ALLOWED_MIMES.has(file.type)) {
    return Response.json(
      { error: `File type not allowed: ${file.type}` },
      { status: 415 },
    );
  }

  // Storage key: {orgId}/{docId}/{uuid}-{filename} — identical to the
  // historical relative path, so existing rows stay compatible.
  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storedName = `${randomUUID()}-${safeFileName}`;
  const relativePath = `${ctx.orgId}/${id}/${storedName}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  // D3: SHA-256 integrity hash over the raw file buffer
  const sha256 = createHash("sha256").update(buffer).digest("hex");

  // #S04-06 / #S06-21 — the declared Content-Type only pre-filters; the
  // leading bytes decide what this actually is, and the sniffed type is
  // what gets stored (and later returned as Content-Type on download).
  const signature = verifyUploadSignature(buffer, {
    allowedMimes: ALLOWED_MIMES,
    declaredMime: file.type,
    // SVG, CSV, Markdown, plain text and XML have no magic bytes. They
    // are in the allowlist and are neutralised on the download path
    // (octet-stream + nosniff + attachment), so an unsniffable payload
    // that looks like text is accepted.
    allowUnknownForText: true,
  });
  if (!signature.ok) {
    return Response.json(
      {
        error:
          signature.reason ?? "File content does not match its declared type",
        code: "content_type_mismatch",
        declaredMime: file.type,
        detectedMime: signature.detectedMime ?? null,
      },
      { status: 415 },
    );
  }
  // OLE2 containers cover .doc/.xls/.ppt indistinguishably — keep the
  // declared legacy type when it is one of those, else take the sniff.
  const effectiveMime =
    signature.detectedMime === "application/x-ole-storage" &&
    OLE2_DECLARED_MIMES.has(file.type)
      ? file.type
      : (signature.detectedMime ?? file.type);

  // The declared type must AGREE with the content. Silently storing a
  // file under its real type would be the safer half of the fix, but it
  // is not enough here: `isPdf` on the download path is derived from
  // the stored mimeType, so a PDF declared as text/plain would be
  // stored as text and never watermarked — the S06-21 residual risk,
  // a second variant of the S06-06 bypass without any encryption. A
  // mismatch is therefore refused outright.
  if (!ALLOWED_MIMES.has(effectiveMime) || effectiveMime !== file.type) {
    return Response.json(
      {
        error: !ALLOWED_MIMES.has(effectiveMime)
          ? `File content is ${effectiveMime}, which is not allowed here (declared ${file.type}).`
          : `File content is ${effectiveMime} but was declared as ${file.type}. Upload the file with its real type.`,
        code: "content_type_mismatch",
        declaredMime: file.type,
        detectedMime: effectiveMime,
      },
      { status: 415 },
    );
  }

  // #S06-06: reject a PDF that could never be handed out as a marked
  // controlled copy. Doing this at upload time is the only moment where
  // the uploader can still fix it; afterwards every download is a
  // choice between refusing a legitimate request and leaking an
  // unmarked original.
  if (effectiveMime === "application/pdf") {
    const stampable = await checkPdfStampable(buffer);
    if (!stampable.ok) {
      await withAuditContext(ctx, async (tx) => {
        await tx.insert(auditLog).values({
          orgId: ctx.orgId,
          userId: ctx.userId,
          userEmail: ctx.session.user.email,
          userName: ctx.session.user.name,
          entityType: "document",
          entityId: id,
          entityTitle: doc.title,
          action: "update",
          actionDetail: "upload_rejected_unstampable_pdf",
          metadata: {
            fileName: file.name,
            fileSize: file.size,
            sha256,
            reason: stampable.reason,
          },
        });
      });
      return Response.json(
        {
          error:
            stampable.reason === "encrypted"
              ? "This PDF is password/permission protected. Controlled-copy watermarking cannot be applied to it, so it cannot be released from the DMS as a marked copy. Please upload an unprotected PDF."
              : `This PDF cannot be watermarked (${stampable.reason}) and therefore cannot be released as a controlled copy.`,
          code: "pdf_not_stampable",
          reason: stampable.reason,
        },
        { status: 422 },
      );
    }
  }

  // Malware scan. In production a scanner that was never configured is
  // the same hole as a fail-open error (WP5 note on S04-06).
  const scan: ClamScanResult = await scanBuffer(buffer);
  if (scan.status === "skipped" && isClamAvRequired()) {
    console.error(
      "[documents/upload] ClamAV is not configured but required in this environment — upload rejected",
    );
    return Response.json(
      {
        error:
          "Malware scanning is mandatory in this environment but no scanner is configured — upload rejected (fail-closed).",
        code: "scan_unavailable",
      },
      { status: 503 },
    );
  }
  if (scan.status === "infected") {
    // Compliance trail: rejected uploads are security events.
    await withAuditContext(ctx, async (tx) => {
      // S03-05: chained by the BEFORE INSERT trigger on audit_log
      // (migration 0401).
      await tx.insert(auditLog).values({
        orgId: ctx.orgId,
        userId: ctx.userId,
        userEmail: ctx.session.user.email,
        userName: ctx.session.user.name,
        entityType: "document",
        entityId: id,
        entityTitle: doc.title,
        action: "update",
        actionDetail: "upload_rejected_infected",
        metadata: {
          fileName: file.name,
          mimeType: effectiveMime,
          fileSize: file.size,
          sha256,
          signature: scan.signature,
        },
      });
    });
    return Response.json(
      {
        error: `Upload rejected: malware detected (${scan.signature ?? "unknown signature"})`,
        code: "malware_detected",
        signature: scan.signature,
      },
      { status: 422 },
    );
  }
  if (scan.status === "error") {
    if (isClamAvFailClosed()) {
      console.error(
        `[documents/upload] ClamAV scan failed (fail-closed): ${scan.error}`,
      );
      return Response.json(
        {
          error: "Malware scan unavailable — upload rejected (fail-closed)",
          code: "scan_unavailable",
        },
        { status: 503 },
      );
    }
    console.warn(
      `[documents/upload] ClamAV scan failed (fail-open, file accepted): ${scan.error}`,
    );
  }
  const scannedAt = scan.status === "skipped" ? null : new Date();

  // #S06-10: every key this handler touches must live under this
  // org's prefix — enforced, not assumed.
  const storage = orgScopedStorage(getFileStorage(), ctx.orgId);
  await storage.put(relativePath, buffer, { contentType: effectiveMime });

  // Best-effort full-text extraction (never blocks the upload).
  const fileText = await extractFileText(buffer, effectiveMime, file.name);

  // #S06-01 (c): one transaction, with the audit context set, so the
  // DB trigger records the actor for every row it touches.
  const result = await withAuditContext(
    ctx,
    async (tx) => {
      // D4: pin the file to the version that is current at upload time
      const [currentVersion] = await tx
        .select({
          id: documentVersion.id,
          filePath: documentVersion.filePath,
          versionNumber: documentVersion.versionNumber,
        })
        .from(documentVersion)
        .where(
          and(
            eq(documentVersion.documentId, id),
            eq(documentVersion.orgId, ctx.orgId),
            eq(documentVersion.isCurrent, true),
          ),
        );

      // #S06-01 (b): a version snapshot that already carries a file is
      // immutable. Filling an EMPTY snapshot is not overwriting
      // history — it is completing the version that is being drafted.
      let targetVersionId = currentVersion?.id ?? null;
      let newVersionLabel: string | null = null;
      let newVersionNumber: number | null = null;

      if (currentVersion && currentVersion.filePath === null) {
        await tx
          .update(documentVersion)
          .set({
            fileName: file.name,
            filePath: relativePath,
            fileSize: file.size,
            mimeType: effectiveMime,
            fileSha256: sha256,
          })
          .where(eq(documentVersion.id, currentVersion.id));
      } else if (currentVersion) {
        // Replacing the file of a version that already has one → new
        // minor version, exactly like a content edit.
        const created = await createDocumentVersion(tx, {
          documentId: id,
          orgId: ctx.orgId,
          userId: ctx.userId,
          bump: "minor",
          content: doc.content ?? null,
          changeSummary: `File replaced: ${file.name}`,
          file: {
            fileName: file.name,
            filePath: relativePath,
            fileSize: file.size,
            mimeType: effectiveMime,
            fileSha256: sha256,
          },
        });
        targetVersionId = created.id;
        newVersionLabel = created.versionLabel;
        newVersionNumber = created.versionNumber;
      }

      const [fileRow] = await tx
        .insert(documentFile)
        .values({
          orgId: ctx.orgId,
          documentId: id,
          versionId: targetVersionId,
          fileName: file.name,
          filePath: relativePath,
          fileSize: file.size,
          mimeType: effectiveMime,
          sha256,
          scanStatus: scan.status,
          scannedAt,
          uploadedBy: ctx.userId,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        })
        .returning();

      // Legacy inline fields mirror the newest (primary) file
      const headUpdate: Record<string, unknown> = {
        fileName: file.name,
        filePath: relativePath,
        fileSize: file.size,
        mimeType: effectiveMime,
        fileSha256: sha256,
        fileText,
        updatedAt: new Date(),
        updatedBy: ctx.userId,
      };
      if (newVersionNumber !== null) {
        headUpdate.currentVersion = newVersionNumber;
      }

      const [updated] = await tx
        .update(document)
        .set(headUpdate)
        .where(and(eq(document.id, id), eq(document.orgId, ctx.orgId)))
        .returning();

      return { fileRow, updated, newVersionLabel };
    },
    {
      actionDetail: `file_uploaded:${safeFileName}`,
    },
  );

  return Response.json(
    {
      data: {
        fileId: result.fileRow.id,
        fileName: result.updated.fileName,
        fileSize: result.updated.fileSize,
        mimeType: result.updated.mimeType,
        sha256,
        scanStatus: scan.status,
        // Non-null when the upload replaced the file of a version that
        // already had one — a new version was created rather than the
        // existing snapshot rewritten (#S06-01).
        newVersionLabel: result.newVersionLabel,
      },
    },
    { status: 201 },
  );
}
