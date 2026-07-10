import { db, document, documentVersion, documentFile } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID, createHash } from "crypto";

const UPLOAD_DIR =
  process.env.UPLOAD_DIR ?? join(process.cwd(), "../../uploads/documents");
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

  // Generate safe path: uploads/documents/{orgId}/{docId}/{uuid}-{filename}
  const orgDir = join(UPLOAD_DIR, ctx.orgId);
  const docDir = join(orgDir, id);
  await mkdir(docDir, { recursive: true });

  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storedName = `${randomUUID()}-${safeFileName}`;
  const filePath = join(docDir, storedName);
  const relativePath = `${ctx.orgId}/${id}/${storedName}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  // D3: SHA-256 integrity hash over the raw file buffer
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  await writeFile(filePath, buffer);

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
      },
    },
    { status: 201 },
  );
}
