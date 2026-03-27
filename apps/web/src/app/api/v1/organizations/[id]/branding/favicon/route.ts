import { db, orgBranding } from "@grc/db";
import { uploadFaviconSchema } from "@grc/shared";
import { eq } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { writeFile, unlink, mkdir } from "fs/promises";
import { join } from "path";

const UPLOAD_DIR = join(process.cwd(), "public", "uploads", "branding");

// POST /api/v1/organizations/:id/branding/favicon -- Upload favicon
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { id: orgId } = await params;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }

  const validation = uploadFaviconSchema.safeParse({
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
  });

  if (!validation.success) {
    return Response.json(
      { error: "Invalid file", details: validation.error.flatten() },
      { status: 400 },
    );
  }

  const ext =
    file.type === "image/x-icon" || file.type === "image/vnd.microsoft.icon"
      ? "ico"
      : "png";
  const storagePath = `branding/${orgId}/favicon.${ext}`;
  const fullPath = join(UPLOAD_DIR, orgId);

  // Ensure directory exists
  await mkdir(fullPath, { recursive: true });

  // Write file to disk
  const buffer = Buffer.from(await file.arrayBuffer());
  const filePath = join(fullPath, `favicon.${ext}`);
  await writeFile(filePath, buffer);

  // Update branding record
  await withAuditContext(ctx, async (tx) => {
    const existing = await tx
      .select()
      .from(orgBranding)
      .where(eq(orgBranding.orgId, orgId))
      .limit(1);

    if (existing[0]) {
      await tx
        .update(orgBranding)
        .set({
          faviconPath: storagePath,
          updatedAt: new Date(),
          updatedBy: ctx.userId,
        })
        .where(eq(orgBranding.orgId, orgId));
    } else {
      await tx.insert(orgBranding).values({
        orgId,
        faviconPath: storagePath,
        updatedBy: ctx.userId,
      });
    }
  });

  const faviconUrl = `/uploads/${storagePath}`;
  return Response.json({ data: { faviconUrl, storagePath } }, { status: 201 });
}

// DELETE /api/v1/organizations/:id/branding/favicon -- Remove favicon
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { id: orgId } = await params;

  await withAuditContext(ctx, async (tx) => {
    const brandings = await tx
      .select()
      .from(orgBranding)
      .where(eq(orgBranding.orgId, orgId))
      .limit(1);

    const branding = brandings[0];
    if (branding?.faviconPath) {
      try {
        const filePath = join(
          UPLOAD_DIR,
          orgId,
          branding.faviconPath.split("/").pop()!,
        );
        await unlink(filePath);
      } catch {
        // File may not exist, that is fine
      }

      await tx
        .update(orgBranding)
        .set({
          faviconPath: null,
          updatedAt: new Date(),
          updatedBy: ctx.userId,
        })
        .where(eq(orgBranding.orgId, orgId));
    }
  });

  return Response.json({ data: { faviconUrl: null } });
}
