import { db, document, documentFile } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { readFile, stat } from "fs/promises";
import { join } from "path";

const UPLOAD_DIR =
  process.env.UPLOAD_DIR ?? join(process.cwd(), "../../uploads/documents");

// GET /api/v1/documents/:id/files/:fileId/download — Download a single
// file attachment (D4). Same SVG-XSS hardening as [id]/download.
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

  const fullPath = join(UPLOAD_DIR, file.filePath);

  try {
    await stat(fullPath);
  } catch {
    return Response.json({ error: "File not found on disk" }, { status: 404 });
  }

  const buffer = await readFile(fullPath);
  const mimeType = file.mimeType ?? "application/octet-stream";

  // #SEC-HIGH-SVG-XSS: see documents/[id]/download/route.ts — force
  // SVG downloads to octet-stream + nosniff so stored XSS can't run.
  const effectiveMimeType =
    mimeType === "image/svg+xml" ? "application/octet-stream" : mimeType;

  const headers: Record<string, string> = {
    "Content-Type": effectiveMimeType,
    "Content-Disposition": `attachment; filename="${encodeURIComponent(file.fileName)}"`,
    "Content-Length": String(buffer.length),
    "X-Content-Type-Options": "nosniff",
  };
  // D3: expose the stored SHA-256 so clients can verify integrity
  if (file.sha256) {
    headers["X-File-SHA256"] = file.sha256;
  }

  return new Response(buffer, { headers });
}
