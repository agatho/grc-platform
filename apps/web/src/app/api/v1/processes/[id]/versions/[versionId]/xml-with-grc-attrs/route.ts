// BPM Overhaul Phase 5: export a specific version's BPMN XML with current
// DB cross-links serialized as arctos:* extension elements per element.

import { db, process, processVersion } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withReadContext } from "@/lib/api";
import {
  ensureArctosNamespace,
  injectGrcMetadata,
} from "@/components/bpmn/arctos-grc-extractor";
import { buildArctosLinksFromDb } from "@/lib/bpmn-arctos-rehydrate";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("bpm", ctx.orgId, req.method);
  if (m) return m;

  const { id, versionId } = await params;
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
  if (!existing)
    return Response.json({ error: "Process not found" }, { status: 404 });

  const [version] = await db
    .select({
      id: processVersion.id,
      versionNumber: processVersion.versionNumber,
      bpmnXml: processVersion.bpmnXml,
    })
    .from(processVersion)
    .where(
      and(eq(processVersion.id, versionId), eq(processVersion.processId, id)),
    );
  if (!version || !version.bpmnXml) {
    return Response.json({ error: "Version not found" }, { status: 404 });
  }

  // Build per-element arctos:* metadata from current DB links
  const links = await withReadContext(ctx, async (tx) =>
    buildArctosLinksFromDb(tx, id, ctx.orgId),
  );

  // Inject into the XML
  let xml = ensureArctosNamespace(version.bpmnXml);
  for (const l of links) {
    xml = injectGrcMetadata(xml, l.bpmnElementId, l.meta);
  }

  const url = new URL(req.url);
  const asDownload = url.searchParams.get("download") === "1";

  return new Response(xml, {
    status: 200,
    headers: {
      "content-type": "application/xml; charset=utf-8",
      ...(asDownload && {
        "content-disposition": `attachment; filename="process-${id.slice(0, 8)}-v${version.versionNumber}.bpmn"`,
      }),
    },
  });
}
