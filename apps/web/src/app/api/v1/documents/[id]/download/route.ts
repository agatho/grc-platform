import { db, document, documentVersion } from "@grc/db";
import { requireModule, requireRole } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import {
  getFileStorage,
  orgScopedStorage,
  FileNotFoundInStorageError,
} from "@grc/shared/lib/file-storage";
import {
  stampControlledCopy,
  WatermarkError,
} from "@/lib/documents/pdf-watermark";
import { recordControlledCopyDownload } from "@/lib/documents/controlled-copy";
import {
  watermarkRequiredForStatus,
  verifyStoredBytes,
} from "@/lib/documents/download-policy";

// GET /api/v1/documents/:id/download — Download file attachment.
//
// Controlled-copy watermarking (ISO document-control practice):
//   - PDFs of RELEASED documents (approved / published / archived /
//     expired — see WATERMARK_REQUIRED_STATUSES, #S06-07) are stamped
//     BY DEFAULT with a footer marking the download as an uncontrolled
//     copy once printed
//   - ?watermarked=1 forces the stamp for any PDF (draft previews etc.)
//   - ?raw=1 returns the original bytes — restricted to
//     admin / quality_manager (the document-control owners)
//   - non-PDF files are never modified (X-Controlled-Copy: none)
//
// #S06-06 — fail-closed: if a required stamp cannot be applied (the
// classic case is a PDF carrying an owner password, which opens in
// every reader without a prompt and which pdf-lib refuses to parse),
// the download is REFUSED with 422. It previously fell back to serving
// the unmarked original and skipped the audit entry, which turned a
// user-supplied input into an unlogged bypass of the control.
//
// #S06-08 — EVERY download is recorded, not just the watermarked one:
// controlled copy, uncontrolled `?raw=1` original and the refused
// watermark failure each write their own audit entry.
//
// #S06-09 — the bytes returned by the object store are re-hashed and
// compared against document.file_sha256 before anything is served. A
// mismatch means the stored object was changed behind the database's
// back and is refused with 409.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
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

  if (!doc.filePath) {
    return Response.json(
      { error: "No file attached to this document" },
      { status: 404 },
    );
  }

  // #S06-10: every key this handler touches must live under this
  // org's prefix — enforced, not assumed.
  const storage = orgScopedStorage(getFileStorage(), ctx.orgId);
  let buffer: Buffer;
  try {
    buffer = await storage.get(doc.filePath);
  } catch (err) {
    if (err instanceof FileNotFoundInStorageError) {
      return Response.json(
        { error: "File not found in storage" },
        { status: 404 },
      );
    }
    throw err;
  }

  const fileName = doc.fileName ?? "download";
  const mimeType = doc.mimeType ?? "application/octet-stream";
  const isPdf = mimeType === "application/pdf";

  // #S06-09: the object store is not trusted to have returned the bytes
  // the database describes.
  const integrity = verifyStoredBytes(buffer, doc.fileSha256 ?? null);
  if (!integrity.ok) {
    await recordControlledCopyDownload(ctx, {
      documentId: id,
      title: doc.title,
      fileName,
      versionLabel: null,
      sha256: doc.fileSha256,
      outcome: "watermark_failed",
      documentStatus: doc.status,
      failureReason: `storage_hash_mismatch:${integrity.actual}`,
      served: false,
    });
    return Response.json(
      {
        error:
          "Stored file does not match the recorded SHA-256 — the object was modified outside the application. Download refused.",
        code: "storage_integrity_mismatch",
        expectedSha256: integrity.expected,
        actualSha256: integrity.actual,
      },
      { status: 409 },
    );
  }

  const url = new URL(req.url);
  const wantsRaw = url.searchParams.get("raw") === "1";
  const forceWatermark = url.searchParams.get("watermarked") === "1";

  // Default: released PDFs leave the DMS only as marked copies.
  let watermark =
    isPdf && (watermarkRequiredForStatus(doc.status) || forceWatermark);
  if (wantsRaw) {
    const roleCheck = requireRole("admin", "quality_manager")(
      ctx.session,
      ctx.orgId,
    );
    if (roleCheck) return roleCheck;
    watermark = false;
  }

  let controlledCopy: "watermarked" | "none" | "raw" = "none";
  let versionLabel: string | null = null;

  if (watermark) {
    const [currentVersion] = await db
      .select({ versionLabel: documentVersion.versionLabel })
      .from(documentVersion)
      .where(
        and(
          eq(documentVersion.documentId, id),
          eq(documentVersion.orgId, ctx.orgId),
          eq(documentVersion.isCurrent, true),
        ),
      );
    versionLabel =
      currentVersion?.versionLabel ?? String(doc.currentVersion ?? "");

    try {
      buffer = await stampControlledCopy(buffer, {
        title: doc.title,
        versionLabel,
        releasedAt: doc.publishedAt,
        retrievedBy:
          ctx.session.user.name ?? ctx.session.user.email ?? "unknown",
        retrievedAt: new Date(),
        documentStatus: doc.status,
      });
      controlledCopy = "watermarked";
    } catch (err) {
      // #S06-06: fail closed. Serving the unmarked original here was
      // the bypass — an uploader chose the input that triggers it.
      const reason =
        err instanceof WatermarkError ? err.reason : "stamp_failed";
      await recordControlledCopyDownload(ctx, {
        documentId: id,
        title: doc.title,
        fileName,
        versionLabel,
        sha256: doc.fileSha256,
        outcome: "watermark_failed",
        documentStatus: doc.status,
        failureReason: reason,
        served: false,
      });
      return Response.json(
        {
          error:
            "This document is released and may only be handed out as a marked controlled copy, but the required watermark could not be applied to this PDF. Re-upload the file without password/permission protection, or request the original via ?raw=1 (document-control roles only — that access is logged).",
          code: "watermark_required",
          reason,
        },
        {
          status: 422,
          headers: { "X-Controlled-Copy": "refused" },
        },
      );
    }
  } else if (wantsRaw) {
    controlledCopy = "raw";
  }

  // #S06-08: log every issuance, not just the controlled one.
  await recordControlledCopyDownload(ctx, {
    documentId: id,
    title: doc.title,
    fileName,
    versionLabel,
    sha256: doc.fileSha256,
    outcome:
      controlledCopy === "watermarked"
        ? "watermarked"
        : controlledCopy === "raw"
          ? "uncontrolled_raw"
          : "unmarked",
    documentStatus: doc.status,
    served: true,
  });

  // #SEC-HIGH-SVG-XSS: documents (uploaded via /:id/upload) are allowed
  // to be SVG, and the download endpoint serves the original Content-
  // Type. Even with Content-Disposition: attachment, a determined
  // attacker could fetch + display inline in a context they control;
  // X-Content-Type-Options: nosniff stops browsers from MIME-sniffing
  // an SVG into image/svg+xml when it's served with another type or
  // forced as binary. Combined with the existing attachment header,
  // this closes the SVG-stored-XSS gap end-to-end for documents.
  //
  // For SVG specifically we also force Content-Type to application/
  // octet-stream so any client that bypasses Content-Disposition
  // (e.g. `curl > foo.svg` then opens in browser later) doesn't
  // execute it inline. The original mime type is preserved in the
  // document.mimeType column for the UI's preview/icon picker.
  const effectiveMimeType =
    mimeType === "image/svg+xml" ? "application/octet-stream" : mimeType;

  const headers: Record<string, string> = {
    "Content-Type": effectiveMimeType,
    "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
    "Content-Length": String(buffer.length),
    "X-Content-Type-Options": "nosniff",
    "X-Controlled-Copy": controlledCopy === "raw" ? "none" : controlledCopy,
  };
  // D3: expose the stored SHA-256 so clients can verify integrity.
  // Watermarking changes the bytes, so the hash only applies to
  // unmodified responses. The value is now backed by an actual
  // re-hash of the delivered bytes (#S06-09), not just the DB column.
  if (doc.fileSha256 && controlledCopy !== "watermarked") {
    headers["X-File-SHA256"] = doc.fileSha256;
  }

  return new Response(new Uint8Array(buffer), { headers });
}
