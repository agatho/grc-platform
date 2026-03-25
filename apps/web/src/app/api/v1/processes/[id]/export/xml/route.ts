import { db, process, processVersion } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/processes/:id/export/xml — Download current version BPMN XML as file
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  // Verify process exists and belongs to org
  const [existing] = await db
    .select({ id: process.id, name: process.name })
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

  // Get current version
  const [version] = await db
    .select({ bpmnXml: processVersion.bpmnXml })
    .from(processVersion)
    .where(
      and(
        eq(processVersion.processId, id),
        eq(processVersion.isCurrent, true),
      ),
    );

  if (!version || !version.bpmnXml) {
    return Response.json(
      { error: "No BPMN XML available for this process" },
      { status: 404 },
    );
  }

  // Sanitize filename
  const safeName = existing.name
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .substring(0, 100);

  return new Response(version.bpmnXml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml",
      "Content-Disposition": `attachment; filename="${safeName}.bpmn"`,
    },
  });
}
