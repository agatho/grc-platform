import { db, document, documentFile, documentVersion } from "@grc/db";
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

// GET /api/v1/documents/:id/files/:fileId/download — Download a single
// file attachment (D4). Same SVG-XSS hardening as [id]/download, and
// the same controlled-copy contract — the rules themselves live in
// lib/documents/download-policy.ts so the two routes cannot drift:
//   - PDFs of released documents are stamped by default (#S06-07),
//     ?watermarked=1 forces it
//   - ?raw=1 (original bytes) only for admin / quality_manager
//   - non-PDFs are served unmodified (X-Controlled-Copy: none)
//   - a required stamp that cannot be applied REFUSES the download
//     (#S06-06) instead of silently serving the unmarked original
//   - every issuance is audit-logged, raw and refusal included (#S06-08)
//   - the stored bytes are re-hashed against document_file.sha256 before
//     anything is served (#S06-09)
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id, fileId } = await params;

  const [doc] = await db
    .select({
      id: document.id,
      title: document.title,
      status: document.status,
      publishedAt: document.publishedAt,
      currentVersion: document.currentVersion,
    })
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

  const [file] = await db
    .select()
    .from(documentFile)
    .where(
      and(
        eq(documentFile.id, fileId),
        eq(documentFile.documentId, id),
        eq(documentFile.orgId, ctx.orgId),
        isNull(documentFile.deletedAt),
      ),
    );

  if (!file) {
    return Response.json({ error: "File not found" }, { status: 404 });
  }

  // #S06-10: every key this handler touches must live under this
  // org's prefix — enforced, not assumed.
  const storage = orgScopedStorage(getFileStorage(), ctx.orgId);
  let buffer: Buffer;
  try {
    buffer = await storage.get(file.filePath);
  } catch (err) {
    if (err instanceof FileNotFoundInStorageError) {
      return Response.json(
        { error: "File not found in storage" },
        { status: 404 },
      );
    }
    throw err;
  }

  const mimeType = file.mimeType ?? "application/octet-stream";
  const isPdf = mimeType === "application/pdf";

  // #S06-09
  const integrity = verifyStoredBytes(buffer, file.sha256 ?? null);
  if (!integrity.ok) {
    await recordControlledCopyDownload(ctx, {
      documentId: id,
      title: doc.title,
      fileName: file.fileName,
      versionLabel: null,
      sha256: file.sha256,
      fileId: file.id,
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
    // D4: files are pinned to the version current at upload time —
    // stamp with that version's label when available.
    if (file.versionId) {
      const [pinnedVersion] = await db
        .select({ versionLabel: documentVersion.versionLabel })
        .from(documentVersion)
        .where(
          and(
            eq(documentVersion.id, file.versionId),
            eq(documentVersion.orgId, ctx.orgId),
          ),
        );
      versionLabel = pinnedVersion?.versionLabel ?? null;
    }
    versionLabel = versionLabel ?? String(doc.currentVersion ?? "");

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
      const reason =
        err instanceof WatermarkError ? err.reason : "stamp_failed";
      await recordControlledCopyDownload(ctx, {
        documentId: id,
        title: doc.title,
        fileName: file.fileName,
        versionLabel,
        sha256: file.sha256,
        fileId: file.id,
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
        { status: 422, headers: { "X-Controlled-Copy": "refused" } },
      );
    }
  } else if (wantsRaw) {
    controlledCopy = "raw";
  }

  await recordControlledCopyDownload(ctx, {
    documentId: id,
    title: doc.title,
    fileName: file.fileName,
    versionLabel,
    sha256: file.sha256,
    fileId: file.id,
    outcome:
      controlledCopy === "watermarked"
        ? "watermarked"
        : controlledCopy === "raw"
          ? "uncontrolled_raw"
          : "unmarked",
    documentStatus: doc.status,
    served: true,
  });

  // #SEC-HIGH-SVG-XSS: see documents/[id]/download/route.ts — force
  // SVG downloads to octet-stream + nosniff so stored XSS can't run.
  const effectiveMimeType =
    mimeType === "image/svg+xml" ? "application/octet-stream" : mimeType;

  const headers: Record<string, string> = {
    "Content-Type": effectiveMimeType,
    "Content-Disposition": `attachment; filename="${encodeURIComponent(file.fileName)}"`,
    "Content-Length": String(buffer.length),
    "X-Content-Type-Options": "nosniff",
    "X-Controlled-Copy": controlledCopy === "raw" ? "none" : controlledCopy,
  };
  // D3: expose the stored SHA-256 so clients can verify integrity —
  // only meaningful for unmodified (non-watermarked) responses.
  if (file.sha256 && controlledCopy !== "watermarked") {
    headers["X-File-SHA256"] = file.sha256;
  }

  return new Response(new Uint8Array(buffer), { headers });
}
