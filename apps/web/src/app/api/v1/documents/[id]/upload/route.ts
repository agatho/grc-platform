import { db, document, documentVersion, documentFile, auditLog } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { getFileStorage } from "@grc/shared/lib/file-storage";
import {
  scanBuffer,
  isClamAvFailClosed,
  type ClamScanResult,
} from "@grc/shared/lib/clamav";
import { extractFileText } from "@/lib/documents/extract-text";
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

// POST /api/v1/documents/:id/upload — Upload file attachment.
// D3: computes SHA-256 over the file buffer for tamper evidence.
// D4: creates a document_file row (multi-file support); the legacy
// inline columns on document keep mirroring the newest upload.
// Storage goes through the FileStorage abstraction (local FS or S3,
// STORAGE_BACKEND env) — the stored key stays the historical
// {orgId}/{docId}/{uuid}-{filename} relative path.
// Optional ClamAV scan (CLAMAV_HOST): infected uploads are rejected
// with 422 + audit-log entry; scan errors follow CLAMAV_FAIL_CLOSED.
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

  // Malware scan (optional — skipped with a one-time notice when
  // CLAMAV_HOST is unset).
  const scan: ClamScanResult = await scanBuffer(buffer);
  if (scan.status === "infected") {
    // Compliance trail: rejected uploads are security events.
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
        actionDetail: "upload_rejected_infected",
        metadata: {
          fileName: file.name,
          mimeType: file.type,
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

  const storage = getFileStorage();
  await storage.put(relativePath, buffer, { contentType: file.type });

  // Best-effort full-text extraction (never blocks the upload).
  const fileText = await extractFileText(buffer, file.type, file.name);

  // D4: pin the file to the version that is current at upload time
  const [currentVersion] = await db
    .select({ id: documentVersion.id })
    .from(documentVersion)
    .where(
      and(
        eq(documentVersion.documentId, id),
        eq(documentVersion.orgId, ctx.orgId),
        eq(documentVersion.isCurrent, true),
      ),
    );

  const [fileRow] = await db
    .insert(documentFile)
    .values({
      orgId: ctx.orgId,
      documentId: id,
      versionId: currentVersion?.id ?? null,
      fileName: file.name,
      filePath: relativePath,
      fileSize: file.size,
      mimeType: file.type,
      sha256,
      scanStatus: scan.status,
      scannedAt,
      uploadedBy: ctx.userId,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    })
    .returning();

  // Legacy inline fields mirror the newest (primary) file
  const [updated] = await db
    .update(document)
    .set({
      fileName: file.name,
      filePath: relativePath,
      fileSize: file.size,
      mimeType: file.type,
      fileSha256: sha256,
      fileText,
      updatedAt: new Date(),
      updatedBy: ctx.userId,
    })
    .where(eq(document.id, id))
    .returning();

  // Keep the current version's file snapshot in sync so restores of
  // this version bring back the file that belonged to it.
  if (currentVersion) {
    await db
      .update(documentVersion)
      .set({
        fileName: file.name,
        filePath: relativePath,
        fileSize: file.size,
        mimeType: file.type,
        fileSha256: sha256,
      })
      .where(eq(documentVersion.id, currentVersion.id));
  }

  return Response.json(
    {
      data: {
        fileId: fileRow.id,
        fileName: updated.fileName,
        fileSize: updated.fileSize,
        mimeType: updated.mimeType,
        sha256,
        scanStatus: scan.status,
      },
    },
    { status: 201 },
  );
}
