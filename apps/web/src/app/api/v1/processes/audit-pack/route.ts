// BPM Overhaul Phase 6: Audit-Pack ZIP export — published processes for
// an ISO 9001 / 27001 audit. Each process becomes a PDF in the ZIP plus
// a RACM CSV and the audit-trail as plain text.
//
// [ARCTOS-FULL-2026-08-31 / WP1 · S09-11]
// This route used to open ONE TRANSACTION PER PROCESS and issue five queries
// inside it, over an unbounded process list: the default branch selects every
// published process of the organisation without a LIMIT. At 500 processes
// that was 500 transactions and well over 2500 round trips in a single
// synchronous HTTP request, while the ZIP was assembled in memory — a
// connection-pool exhaustion and request-timeout hazard.
//
// It now runs five SET-BASED queries for the whole batch inside ONE read
// transaction and groups the rows in memory, and it refuses batches above
// AUDIT_PACK_MAX_PROCESSES instead of trying to stream an unbounded export.
// Round trips are constant (6) instead of linear in the number of processes.

import JSZip from "jszip";
import { db, process } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, inArray, sql } from "drizzle-orm";
import { withAuth, withReadContext } from "@/lib/api";
import { z } from "zod";
import { toCsvRow } from "@/lib/import-export/csv-sanitizer";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

const schema = z.object({
  processIds: z.array(z.string().uuid()).optional(),
  frameworkCode: z.string().optional(),
});

// An audit pack is assembled synchronously and held in memory. Beyond this
// many processes the caller has to narrow the selection (framework filter or
// explicit processIds); an unbounded export is not a useful product feature,
// it is an availability risk.
const AUDIT_PACK_MAX_PROCESSES = 250;

/** `IN (…)` list for a raw SQL fragment. */
function idList(ids: string[]) {
  return sql.join(
    ids.map((id) => sql`${id}`),
    sql`, `,
  );
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const bucket = out.get(k);
    if (bucket) bucket.push(row);
    else out.set(k, [row]);
  }
  return out;
}

export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth(
    "admin",
    "auditor",
    "compliance_officer",
    "quality_manager",
  );
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("bpm", ctx.orgId, req.method);
  if (m) return m;

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  // Resolve target processes: explicit IDs, OR all published + filtered by framework code
  let processes: {
    id: string;
    name: string;
    department: string | null;
    status: string;
  }[];
  if (parsed.data.processIds?.length) {
    processes = await db
      .select({
        id: process.id,
        name: process.name,
        department: process.department,
        status: process.status,
      })
      .from(process)
      .where(
        and(
          eq(process.orgId, ctx.orgId),
          inArray(process.id, parsed.data.processIds),
          isNull(process.deletedAt),
        ),
      );
  } else if (parsed.data.frameworkCode) {
    processes = await withReadContext(ctx, async (tx) => {
      return (await tx.execute(sql`
        SELECT DISTINCT p.id, p.name, p.department, p.status
        FROM process p
        JOIN process_framework_mapping pfm ON pfm.process_id = p.id
        WHERE p.org_id = ${ctx.orgId}
          AND p.status = 'published'
          AND p.deleted_at IS NULL
          AND pfm.framework_code = ${parsed.data.frameworkCode}
      `)) as any[];
    });
  } else {
    processes = await db
      .select({
        id: process.id,
        name: process.name,
        department: process.department,
        status: process.status,
      })
      .from(process)
      .where(
        and(
          eq(process.orgId, ctx.orgId),
          eq(process.status, "published"),
          isNull(process.deletedAt),
        ),
      );
  }

  if (processes.length === 0) {
    return Response.json({ error: "No matching processes" }, { status: 404 });
  }
  if (processes.length > AUDIT_PACK_MAX_PROCESSES) {
    return Response.json(
      {
        error: "Selection too large",
        detail: `The audit pack is limited to ${AUDIT_PACK_MAX_PROCESSES} processes per request; ${processes.length} matched. Narrow the selection with frameworkCode or an explicit processIds list.`,
      },
      { status: 413 },
    );
  }

  // S09-11: one transaction, five set-based queries for the whole batch.
  const processIds = processes.map((p) => p.id);
  const batch = await withReadContext(ctx, async (tx) => {
    const metaRows = (await tx.execute(sql`
      SELECT p.id, p.name, p.description, p.department, p.status,
             p.current_version, p.published_at,
             (SELECT u.name FROM "user" u WHERE u.id = p.process_owner_id) AS owner,
             (SELECT u.name FROM "user" u WHERE u.id = p.reviewer_id) AS reviewer
      FROM process p WHERE p.id IN (${idList(processIds)})
    `)) as any[];

    const signOffRows = (await tx.execute(sql`
      SELECT process_id, signer_role, signoff_type, signed_at, comments, chain_hash
      FROM process_sign_off
      WHERE process_id IN (${idList(processIds)})
      ORDER BY process_id, signed_at
    `)) as any[];

    const mappingRows = (await tx.execute(sql`
      SELECT process_id, framework_code, entry_code, entry_title, mapping_strength
      FROM process_framework_mapping
      WHERE process_id IN (${idList(processIds)})
    `)) as any[];

    const racmRows = (await tx.execute(sql`
      SELECT ps.process_id, ps.bpmn_element_id, ps.name AS step_name, ps.line_of_defense,
             (SELECT json_agg(r.title) FROM risk r
                JOIN process_step_risk psr ON psr.risk_id = r.id
                WHERE psr.process_step_id = ps.id) AS risks,
             (SELECT json_agg(c.title) FROM control c
                JOIN process_step_control psc ON psc.control_id = c.id
                WHERE psc.process_step_id = ps.id) AS controls
      FROM process_step ps
      WHERE ps.process_id IN (${idList(processIds)}) AND ps.deleted_at IS NULL
      ORDER BY ps.process_id, ps.sequence_order
    `)) as any[];

    const xmlRows = (await tx.execute(sql`
      SELECT process_id, bpmn_xml FROM process_version
      WHERE process_id IN (${idList(processIds)}) AND is_current = true
    `)) as any[];

    return { metaRows, signOffRows, mappingRows, racmRows, xmlRows };
  });

  const metaById = new Map(batch.metaRows.map((r: any) => [r.id, r]));
  const signOffsByProcess = groupBy(
    batch.signOffRows,
    (r: any) => r.process_id,
  );
  const mappingsByProcess = groupBy(
    batch.mappingRows,
    (r: any) => r.process_id,
  );
  const racmByProcess = groupBy(batch.racmRows, (r: any) => r.process_id);
  const xmlByProcess = new Map(
    batch.xmlRows.map((r: any) => [r.process_id, r.bpmn_xml]),
  );

  const zip = new JSZip();
  const manifest: string[] = [
    "ARCTOS Audit Pack",
    `Generated: ${new Date().toISOString()}`,
    `Organization: ${ctx.orgId}`,
    parsed.data.frameworkCode
      ? `Framework filter: ${parsed.data.frameworkCode}`
      : "",
    `Process count: ${processes.length}`,
    "",
    "Contents:",
  ];

  for (const p of processes) {
    const slug = p.name.replace(/[^A-Za-z0-9_-]+/g, "-").slice(0, 60);
    const folder = zip.folder(slug)!;

    const meta = {
      meta: metaById.get(p.id),
      signOffs: signOffsByProcess.get(p.id) ?? [],
      mappings: mappingsByProcess.get(p.id) ?? [],
      racmRows: racmByProcess.get(p.id) ?? [],
      xmlRow: { bpmn_xml: xmlByProcess.get(p.id) },
    };

    // README per process
    folder.file(
      "README.txt",
      [
        `Process: ${meta.meta?.name ?? p.name}`,
        `Status: ${meta.meta?.status ?? p.status}`,
        `Department: ${meta.meta?.department ?? "-"}`,
        `Owner: ${meta.meta?.owner ?? "-"}`,
        `Reviewer: ${meta.meta?.reviewer ?? "-"}`,
        `Current version: ${meta.meta?.current_version ?? "-"}`,
        `Published at: ${meta.meta?.published_at ?? "-"}`,
        "",
        "Description:",
        meta.meta?.description ?? "(none)",
      ].join("\n"),
    );

    if (meta.xmlRow?.bpmn_xml) {
      folder.file("bpmn.xml", meta.xmlRow.bpmn_xml);
    }

    // #S04-05: hand-rolled quoting only — a step name, risk or control
    // title starting with `=`/`+`/`-`/`@` was exported as a live formula.
    const racmCsv = [
      toCsvRow(["Activity", "LineOfDefense", "Risks", "Controls"]),
      ...meta.racmRows.map((r: any) =>
        toCsvRow([
          r.step_name ?? r.bpmn_element_id,
          r.line_of_defense ?? "",
          r.risks ?? [],
          r.controls ?? [],
        ]),
      ),
    ].join("\n");
    folder.file("racm.csv", racmCsv);

    // Framework mappings
    folder.file(
      "framework-mappings.csv",
      [
        toCsvRow(["Framework", "EntryCode", "Title", "Strength"]),
        ...meta.mappings.map((m: any) =>
          toCsvRow([
            m.framework_code ?? "",
            m.entry_code ?? "",
            m.entry_title ?? "",
            m.mapping_strength ?? "",
          ]),
        ),
      ].join("\n"),
    );

    // Sign-off chain
    folder.file(
      "sign-off-chain.txt",
      meta.signOffs
        .map(
          (s: any) =>
            `${s.signed_at}  ${s.signoff_type.padEnd(10)} ${s.signer_role.padEnd(20)} chain:${s.chain_hash?.slice(0, 16) ?? ""}\n${s.comments ?? ""}`,
        )
        .join("\n\n"),
    );

    manifest.push(
      `- ${slug}/ (${meta.racmRows.length} activities, ${meta.signOffs.length} sign-offs)`,
    );
  }

  zip.file("MANIFEST.txt", manifest.join("\n"));
  const buf = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
  });

  return new Response(
    new Blob([buf as BlobPart], { type: "application/zip" }),
    {
      status: 200,
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="audit-pack-${parsed.data.frameworkCode ?? "all"}-${Date.now()}.zip"`,
      },
    },
  );
});
