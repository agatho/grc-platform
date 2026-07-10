import { db, document, documentVersion } from "@grc/db";
import { requireModule, requireRole } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import {
  getFileStorage,
  FileNotFoundInStorageError,
} from "@grc/shared/lib/file-storage";
import { stampControlledCopy } from "@/lib/documents/pdf-watermark";
import { recordControlledCopyDownload } from "@/lib/documents/controlled-copy";

// GET /api/v1/documents/:id/download — Download file attachment.
//
// Controlled-copy watermarking (ISO document-control practice):
//   - published PDFs are stamped BY DEFAULT with a footer marking the
//     download as an uncontrolled copy once printed
//   - ?watermarked=1 forces the stamp for any PDF (draft previews etc.)
//   - ?raw=1 returns the original bytes — restricted to
//     admin / quality_manager (the document-control owners)
//   - non-PDF files are never modified (X-Controlled-Copy: none)
// Watermarked downloads are recorded in the audit log (who, when,
// which version) so controlled distribution is demonstrable.
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

  const storage = getFileStorage();
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

  const url = new URL(req.url);
  const wantsRaw = url.searchParams.get("raw") === "1";
  const forceWatermark = url.searchParams.get("watermarked") === "1";

  // Default: published PDFs leave the DMS only as marked copies.
  let watermark = isPdf && (doc.status === "published" || forceWatermark);
  if (wantsRaw) {
    const roleCheck = requireRole("admin", "quality_manager")(
      ctx.session,
      ctx.orgId,
    );
    if (roleCheck) return roleCheck;
    watermark = false;
  }

  let controlledCopy: "watermarked" | "none" | "error" = "none";
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
      });
      controlledCopy = "watermarked";
    } catch {
      // Corrupt/encrypted PDF — serve the original and flag it instead
      // of blocking the download.
      controlledCopy = "error";
    }
  }

  if (controlledCopy === "watermarked") {
    // Audit trail: controlled-copy issuance is compliance-relevant.
    await recordControlledCopyDownload(ctx, {
      documentId: id,
      title: doc.title,
      fileName,
      versionLabel,
      sha256: doc.fileSha256,
    });
  }

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
    "X-Controlled-Copy": controlledCopy,
  };
  // D3: expose the stored SHA-256 so clients can verify integrity.
  // Watermarking changes the bytes, so the hash only applies to
  // unmodified responses.
  if (doc.fileSha256 && controlledCopy !== "watermarked") {
    headers["X-File-SHA256"] = doc.fileSha256;
  }

  return new Response(new Uint8Array(buffer), { headers });
}
