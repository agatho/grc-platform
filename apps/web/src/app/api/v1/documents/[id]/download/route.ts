import { db, document } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { readFile, stat } from "fs/promises";
import { join } from "path";

const UPLOAD_DIR =
  process.env.UPLOAD_DIR ?? join(process.cwd(), "../../uploads/documents");

// GET /api/v1/documents/:id/download — Download file attachment
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

  const fullPath = join(UPLOAD_DIR, doc.filePath);

  try {
    await stat(fullPath);
  } catch {
    return Response.json({ error: "File not found on disk" }, { status: 404 });
  }

  const buffer = await readFile(fullPath);
  const fileName = doc.fileName ?? "download";
  const mimeType = doc.mimeType ?? "application/octet-stream";

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
  };
  // D3: expose the stored SHA-256 so clients can verify integrity
  if (doc.fileSha256) {
    headers["X-File-SHA256"] = doc.fileSha256;
  }

  return new Response(buffer, { headers });
}
