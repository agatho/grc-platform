import { db, document, auditLog } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { readFile } from "fs/promises";
import { join } from "path";
import { createHash } from "crypto";

const UPLOAD_DIR =
  process.env.UPLOAD_DIR ?? join(process.cwd(), "../../uploads/documents");

// GET /api/v1/documents/:id/verify-integrity — Recompute the SHA-256
// of the stored file and compare it with the hash captured at upload
// time (D3). The verification result is written to the audit log.
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

  if (!doc.fileSha256) {
    return Response.json(
      { error: "No stored hash available — file was uploaded before integrity hashing was introduced" },
      { status: 422 },
    );
  }

  let actual: string | null = null;
  let fileMissing = false;
  try {
    const buffer = await readFile(join(UPLOAD_DIR, doc.filePath));
    actual = createHash("sha256").update(buffer).digest("hex");
  } catch {
    fileMissing = true;
  }

  const valid = !fileMissing && actual === doc.fileSha256;

  // Audit trail: integrity verifications are compliance-relevant events
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
      actionDetail: valid
        ? "integrity_check_passed"
        : fileMissing
          ? "integrity_check_file_missing"
          : "integrity_check_failed",
      metadata: {
        fileName: doc.fileName,
        expectedSha256: doc.fileSha256,
        actualSha256: actual,
        valid,
        fileMissing,
      },
    });
  });

  return Response.json({
    data: {
      valid,
      fileMissing,
      fileName: doc.fileName,
      expectedSha256: doc.fileSha256,
      actualSha256: actual,
      checkedAt: new Date().toISOString(),
    },
  });
}
