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

  return new Response(buffer, {
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
      "Content-Length": String(buffer.length),
    },
  });
}
