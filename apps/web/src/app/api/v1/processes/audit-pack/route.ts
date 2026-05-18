// BPM Overhaul Phase 6: Audit-Pack ZIP export — published processes for
// an ISO 9001 / 27001 audit. Each process becomes a PDF in the ZIP plus
// a RACM CSV and the audit-trail as plain text.

import JSZip from "jszip";
import { db, process } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, inArray, sql } from "drizzle-orm";
import { withAuth, withReadContext } from "@/lib/api";
import { z } from "zod";

const schema = z.object({
  processIds: z.array(z.string().uuid()).optional(),
  frameworkCode: z.string().optional(),
});

export async function POST(req: Request) {
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

    // 1. Process metadata + sign-off history
    const meta = await withReadContext(ctx, async (tx) => {
      const [meta] = (await tx.execute(sql`
        SELECT p.id, p.name, p.description, p.department, p.status,
               p.current_version, p.published_at,
               (SELECT u.name FROM "user" u WHERE u.id = p.process_owner_id) AS owner,
               (SELECT u.name FROM "user" u WHERE u.id = p.reviewer_id) AS reviewer
        FROM process p WHERE p.id = ${p.id}
      `)) as any[];

      const signOffs = (await tx.execute(sql`
        SELECT signer_role, signoff_type, signed_at, comments, chain_hash
        FROM process_sign_off
        WHERE process_id = ${p.id}
        ORDER BY signed_at
      `)) as any[];

      const mappings = (await tx.execute(sql`
        SELECT framework_code, entry_code, entry_title, mapping_strength
        FROM process_framework_mapping
        WHERE process_id = ${p.id}
      `)) as any[];

      const racmRows = (await tx.execute(sql`
        SELECT ps.bpmn_element_id, ps.name AS step_name, ps.line_of_defense,
               (SELECT json_agg(r.title) FROM risk r
                  JOIN process_step_risk psr ON psr.risk_id = r.id
                  WHERE psr.process_step_id = ps.id) AS risks,
               (SELECT json_agg(c.title) FROM control c
                  JOIN process_step_control psc ON psc.control_id = c.id
                  WHERE psc.process_step_id = ps.id) AS controls
        FROM process_step ps
        WHERE ps.process_id = ${p.id} AND ps.deleted_at IS NULL
        ORDER BY ps.sequence_order
      `)) as any[];

      const xmlRow = (await tx.execute(sql`
        SELECT bpmn_xml FROM process_version
        WHERE process_id = ${p.id} AND is_current = true
        LIMIT 1
      `)) as any[];

      return { meta, signOffs, mappings, racmRows, xmlRow: xmlRow[0] };
    });

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

    // RACM CSV
    const racmCsv = [
      "Activity,LineOfDefense,Risks,Controls",
      ...meta.racmRows.map((r: any) =>
        [
          `"${(r.step_name ?? r.bpmn_element_id).replace(/"/g, '""')}"`,
          r.line_of_defense ?? "",
          `"${(r.risks ?? []).join("; ")}"`,
          `"${(r.controls ?? []).join("; ")}"`,
        ].join(","),
      ),
    ].join("\n");
    folder.file("racm.csv", racmCsv);

    // Framework mappings
    folder.file(
      "framework-mappings.csv",
      [
        "Framework,EntryCode,Title,Strength",
        ...meta.mappings.map((m: any) =>
          [
            m.framework_code ?? "",
            m.entry_code ?? "",
            `"${(m.entry_title ?? "").replace(/"/g, '""')}"`,
            m.mapping_strength ?? "",
          ].join(","),
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

  return new Response(buf, {
    status: 200,
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="audit-pack-${parsed.data.frameworkCode ?? "all"}-${Date.now()}.zip"`,
    },
  });
}
