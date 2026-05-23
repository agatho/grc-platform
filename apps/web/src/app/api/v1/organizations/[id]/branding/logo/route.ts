import { db, orgBranding } from "@grc/db";
import { uploadLogoSchema } from "@grc/shared";
import { eq } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { writeFile, unlink, mkdir } from "fs/promises";
import { join } from "path";

const UPLOAD_DIR = join(process.cwd(), "public", "uploads", "branding");

// POST /api/v1/organizations/:id/branding/logo -- Upload logo
//
// #CRIT-SEC-CROSS-TENANT: previously the orgId from the URL path was
// trusted blindly. An admin of org A could POST to
// /organizations/{org_B_id}/branding/logo and (a) overwrite the file
// on disk at uploads/branding/{org_B_id}/, (b) update org_B's
// orgBranding row. The orgId path param was used in both filesystem
// path and DB record without ever being compared to ctx.orgId.
//
// #CRIT-SEC-SVG-XSS: SVG was accepted as upload type and then served
// inline from /uploads/. SVG can contain arbitrary <script> — stored
// XSS against anyone who later views that branding. Dropping SVG
// outright; the only safe inline-served SVG would need DOMPurify-grade
// sanitisation, which we don't currently do.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { id: orgId } = await params;

  // Cross-tenant guard: the URL's orgId must match the caller's own
  // org. Without this, an admin of org A can write org B's branding.
  if (orgId !== ctx.orgId) {
    return Response.json(
      { error: "Forbidden — cannot modify another organization's branding" },
      { status: 403 },
    );
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }

  const validation = uploadLogoSchema.safeParse({
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

  // Reject SVG: it would be served inline from /uploads/, and SVG
  // supports <script>. PNG/JPG/WebP only.
  if (
    file.type === "image/svg+xml" ||
    file.name.toLowerCase().endsWith(".svg")
  ) {
    return Response.json(
      {
        error: "SVG upload is not allowed for branding assets",
        detail:
          "Use PNG, JPG, or WebP. SVG can carry stored XSS when served inline.",
      },
      { status: 415 },
    );
  }

  const ext = "png";
  const storagePath = `branding/${orgId}/logo.${ext}`;
  const fullPath = join(UPLOAD_DIR, orgId);

  // Ensure directory exists
  await mkdir(fullPath, { recursive: true });

  // Write file to disk
  const buffer = Buffer.from(await file.arrayBuffer());
  const filePath = join(fullPath, `logo.${ext}`);
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
          logoPath: storagePath,
          updatedAt: new Date(),
          updatedBy: ctx.userId,
        })
        .where(eq(orgBranding.orgId, orgId));
    } else {
      await tx.insert(orgBranding).values({
        orgId,
        logoPath: storagePath,
        updatedBy: ctx.userId,
      });
    }
  });

  const logoUrl = `/uploads/${storagePath}`;
  return Response.json({ data: { logoUrl, storagePath } }, { status: 201 });
}

// DELETE /api/v1/organizations/:id/branding/logo -- Remove logo
//
// Same cross-tenant guard as POST — DELETE on another org's branding
// row was also previously possible.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { id: orgId } = await params;

  if (orgId !== ctx.orgId) {
    return Response.json(
      { error: "Forbidden — cannot modify another organization's branding" },
      { status: 403 },
    );
  }

  await withAuditContext(ctx, async (tx) => {
    const brandings = await tx
      .select()
      .from(orgBranding)
      .where(eq(orgBranding.orgId, orgId))
      .limit(1);

    const branding = brandings[0];
    if (branding?.logoPath) {
      // Try to delete file from disk
      try {
        const filePath = join(
          UPLOAD_DIR,
          orgId,
          branding.logoPath.split("/").pop()!,
        );
        await unlink(filePath);
      } catch {
        // File may not exist, that is fine
      }

      await tx
        .update(orgBranding)
        .set({
          logoPath: null,
          updatedAt: new Date(),
          updatedBy: ctx.userId,
        })
        .where(eq(orgBranding.orgId, orgId));
    }
  });

  return Response.json({ data: { logoUrl: null } });
}
