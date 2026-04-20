import { db, process, processVersion } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/processes/:id/versions/:versionId — Get specific version with BPMN XML
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id, versionId } = await params;

  // Verify process exists and belongs to org
  const [existing] = await db
    .select({ id: process.id })
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

  const [version] = await db
    .select()
    .from(processVersion)
    .where(
      and(eq(processVersion.id, versionId), eq(processVersion.processId, id)),
    );

  if (!version) {
    return Response.json({ error: "Version not found" }, { status: 404 });
  }

  return Response.json({ data: version });
}
