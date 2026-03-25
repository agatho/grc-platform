import { db, process, processVersion } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { z } from "zod";

const restoreVersionSchema = z.object({
  versionId: z.string().uuid(),
});

// POST /api/v1/processes/:id/versions/restore — Restore old version (creates NEW version)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const body = restoreVersionSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Verify process exists and belongs to org
  const [existing] = await db
    .select({
      id: process.id,
      currentVersion: process.currentVersion,
    })
    .from(process)
    .where(
      and(
        eq(process.id, id),
        eq(process.orgId, ctx.orgId),
        isNull(process.deletedAt),
      ),
    );

  if (!existing) {
    return Response.json({ error: "Process not found" }, { status: 404 });
  }

  // Fetch the old version to restore
  const [oldVersion] = await db
    .select()
    .from(processVersion)
    .where(
      and(
        eq(processVersion.id, body.data.versionId),
        eq(processVersion.processId, id),
      ),
    );

  if (!oldVersion) {
    return Response.json({ error: "Version not found" }, { status: 404 });
  }

  const newVersionNumber = existing.currentVersion + 1;

  const result = await withAuditContext(ctx, async (tx) => {
    // Mark all existing versions as not current
    await tx
      .update(processVersion)
      .set({ isCurrent: false })
      .where(eq(processVersion.processId, id));

    // Create NEW version with old version's XML
    const [version] = await tx
      .insert(processVersion)
      .values({
        processId: id,
        orgId: ctx.orgId,
        versionNumber: newVersionNumber,
        bpmnXml: oldVersion.bpmnXml,
        diagramJson: oldVersion.diagramJson,
        changeSummary: `Restored from version ${oldVersion.versionNumber}`,
        isCurrent: true,
        createdBy: ctx.userId,
      })
      .returning();

    // Update process currentVersion
    await tx
      .update(process)
      .set({
        currentVersion: newVersionNumber,
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .where(eq(process.id, id));

    return version;
  });

  return Response.json({ data: result }, { status: 201 });
}
