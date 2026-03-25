import { db, process, processVersion } from "@grc/db";
import { requireModule } from "@grc/auth";
import { versionCompareQuerySchema, computeBpmnDiff, computeElementDetails } from "@grc/shared";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/processes/:id/versions/compare?from=1&to=2 — Compare two versions
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  // Parse query params
  const url = new URL(req.url);
  const queryParse = versionCompareQuerySchema.safeParse({
    processId: id,
    versionA: url.searchParams.get("from"),
    versionB: url.searchParams.get("to"),
  });

  if (!queryParse.success) {
    return Response.json(
      { error: "Validation failed", details: queryParse.error.flatten() },
      { status: 422 },
    );
  }

  const { versionA, versionB } = queryParse.data;

  // Verify process exists and belongs to org
  const [proc] = await db
    .select({ id: process.id })
    .from(process)
    .where(
      and(
        eq(process.id, id),
        eq(process.orgId, ctx.orgId),
        isNull(process.deletedAt),
      ),
    );

  if (!proc) {
    return Response.json({ error: "Process not found" }, { status: 404 });
  }

  // Fetch both versions
  const [verA, verB] = await Promise.all([
    db
      .select({
        versionNumber: processVersion.versionNumber,
        bpmnXml: processVersion.bpmnXml,
      })
      .from(processVersion)
      .where(
        and(
          eq(processVersion.processId, id),
          eq(processVersion.versionNumber, versionA),
        ),
      )
      .then((rows) => rows[0]),
    db
      .select({
        versionNumber: processVersion.versionNumber,
        bpmnXml: processVersion.bpmnXml,
      })
      .from(processVersion)
      .where(
        and(
          eq(processVersion.processId, id),
          eq(processVersion.versionNumber, versionB),
        ),
      )
      .then((rows) => rows[0]),
  ]);

  if (!verA) {
    return Response.json(
      { error: `Version ${versionA} not found` },
      { status: 404 },
    );
  }

  if (!verB) {
    return Response.json(
      { error: `Version ${versionB} not found` },
      { status: 404 },
    );
  }

  if (!verA.bpmnXml || !verB.bpmnXml) {
    return Response.json(
      { error: "One or both versions have no BPMN XML" },
      { status: 422 },
    );
  }

  // Compute diff and element details
  const diff = computeBpmnDiff(verA.bpmnXml, verB.bpmnXml);
  const details = computeElementDetails(
    verA.bpmnXml,
    verB.bpmnXml,
    diff.modified,
  );

  return Response.json({
    data: {
      processId: id,
      versionA,
      versionB,
      diff,
      details,
    },
  });
}
