// BPM Overhaul Phase 6 P6: Detailed version-compare endpoint.
//
// Returns:
//   - the two XML blobs (so the UI can render both BPMN viewers side-by-side)
//   - a derived arctos:* diff between the versions (risk-link added/removed,
//     control-link added/removed, LoD change)
//   - high-level metadata (versionNumber, createdAt, createdBy)

import { db, process, processVersion } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { extractGrcMetadata } from "@/components/bpmn/arctos-grc-extractor";

interface ArctosDiff {
  bpmnElementId: string;
  added: { risks: string[]; controls: string[]; documents: string[] };
  removed: { risks: string[]; controls: string[]; documents: string[] };
  lodChange?: {
    from: string | null | undefined;
    to: string | null | undefined;
  };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("bpm", ctx.orgId, req.method);
  if (m) return m;

  const { id } = await params;
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
  if (!existing)
    return Response.json({ error: "Process not found" }, { status: 404 });

  const url = new URL(req.url);
  const fromId = url.searchParams.get("from");
  const toId = url.searchParams.get("to");
  if (!fromId || !toId) {
    return Response.json(
      { error: "from + to query params required" },
      { status: 400 },
    );
  }

  const rows = await db
    .select({
      id: processVersion.id,
      versionNumber: processVersion.versionNumber,
      bpmnXml: processVersion.bpmnXml,
      changeSummary: processVersion.changeSummary,
      createdAt: processVersion.createdAt,
      createdBy: processVersion.createdBy,
    })
    .from(processVersion)
    .where(
      and(
        eq(processVersion.processId, id),
        inArray(processVersion.id, [fromId, toId]),
      ),
    );

  const from = rows.find((r) => r.id === fromId);
  const to = rows.find((r) => r.id === toId);
  if (!from || !to) {
    return Response.json({ error: "version not found" }, { status: 404 });
  }

  // Compute arctos:* diff: enumerate elements with metadata in either xml.
  const elementIdRe = /\bid="([^"]+)"[^>]*?>[\s\S]*?<arctos:grcMetadata/g;
  const collect = (xml: string | null) => {
    const set = new Set<string>();
    if (!xml) return set;
    let m: RegExpExecArray | null;
    while ((m = elementIdRe.exec(xml)) !== null) set.add(m[1]);
    elementIdRe.lastIndex = 0;
    return set;
  };
  const ids = new Set<string>([
    ...collect(from.bpmnXml),
    ...collect(to.bpmnXml),
  ]);

  const diffs: ArctosDiff[] = [];
  for (const eid of ids) {
    const a = from.bpmnXml ? extractGrcMetadata(from.bpmnXml, eid) : null;
    const b = to.bpmnXml ? extractGrcMetadata(to.bpmnXml, eid) : null;

    const aRisks = new Set(
      (a?.riskRefs ?? []).map((r) => r.id).filter(Boolean) as string[],
    );
    const bRisks = new Set(
      (b?.riskRefs ?? []).map((r) => r.id).filter(Boolean) as string[],
    );
    const aCtrls = new Set(
      (a?.controlRefs ?? []).map((c) => c.id).filter(Boolean) as string[],
    );
    const bCtrls = new Set(
      (b?.controlRefs ?? []).map((c) => c.id).filter(Boolean) as string[],
    );
    const aDocs = new Set(
      (a?.documentRefs ?? []).map((d) => d.id).filter(Boolean) as string[],
    );
    const bDocs = new Set(
      (b?.documentRefs ?? []).map((d) => d.id).filter(Boolean) as string[],
    );

    const diff: ArctosDiff = {
      bpmnElementId: eid,
      added: {
        risks: [...bRisks].filter((x) => !aRisks.has(x)),
        controls: [...bCtrls].filter((x) => !aCtrls.has(x)),
        documents: [...bDocs].filter((x) => !aDocs.has(x)),
      },
      removed: {
        risks: [...aRisks].filter((x) => !bRisks.has(x)),
        controls: [...aCtrls].filter((x) => !bCtrls.has(x)),
        documents: [...aDocs].filter((x) => !bDocs.has(x)),
      },
    };
    if ((a?.lineOfDefense ?? null) !== (b?.lineOfDefense ?? null)) {
      diff.lodChange = { from: a?.lineOfDefense, to: b?.lineOfDefense };
    }
    const hasChange =
      diff.added.risks.length ||
      diff.added.controls.length ||
      diff.added.documents.length ||
      diff.removed.risks.length ||
      diff.removed.controls.length ||
      diff.removed.documents.length ||
      diff.lodChange;
    if (hasChange) diffs.push(diff);
  }

  return Response.json({
    data: {
      from: {
        id: from.id,
        versionNumber: from.versionNumber,
        bpmnXml: from.bpmnXml,
        changeSummary: from.changeSummary,
      },
      to: {
        id: to.id,
        versionNumber: to.versionNumber,
        bpmnXml: to.bpmnXml,
        changeSummary: to.changeSummary,
      },
      arctosDiff: diffs,
    },
  });
}
