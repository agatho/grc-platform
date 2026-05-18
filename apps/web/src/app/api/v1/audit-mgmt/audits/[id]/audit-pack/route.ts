// Audit Overhaul Phase 2: per-audit ZIP audit-pack.
//
// Bundles README.txt, scope.txt, checklist.csv, findings.csv, evidence.csv,
// working-papers.csv, sign-off-chain.txt, plus the report document if attached.

import JSZip from "jszip";
import { db, audit } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, sql } from "drizzle-orm";
import { withAuth, withReadContext } from "@/lib/api";

function csv(s: unknown): string {
  if (s == null) return "";
  const str = Array.isArray(s) ? s.join("; ") : String(s);
  if (/[",\n;]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth(
    "admin",
    "auditor",
    "compliance_officer",
    "quality_manager",
  );
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("audit", ctx.orgId, req.method);
  if (m) return m;

  const { id } = await params;
  const [a] = await db
    .select()
    .from(audit)
    .where(
      and(
        eq(audit.id, id),
        eq(audit.orgId, ctx.orgId),
        isNull(audit.deletedAt),
      ),
    );
  if (!a) return Response.json({ error: "Audit not found" }, { status: 404 });

  const data = await withReadContext(ctx, async (tx) => {
    const [auditDetail] = (await tx.execute(sql`
      SELECT a.*,
        (SELECT u.name FROM "user" u WHERE u.id = a.lead_auditor_id) AS lead_auditor_name,
        (SELECT u.name FROM "user" u WHERE u.id = a.auditee_id) AS auditee_name,
        (SELECT d.title FROM document d WHERE d.id = a.report_document_id) AS report_title,
        (SELECT d.file_path FROM document d WHERE d.id = a.report_document_id) AS report_path
      FROM audit a WHERE a.id = ${id}
    `)) as any[];

    const checklist = (await tx.execute(sql`
      SELECT ci.id, ci.title, ci.description, ci.result, ci.method_entries, ci.risk_rating,
             ci.notes, c.title AS control_title
      FROM audit_checklist ck
      JOIN audit_checklist_item ci ON ci.audit_checklist_id = ck.id
      LEFT JOIN control c ON c.id = ci.control_id
      WHERE ck.audit_id = ${id}
      ORDER BY ck.created_at, ci.created_at
    `)) as any[];

    const findings = (await tx.execute(sql`
      SELECT f.id, f.title, f.severity, f.status, f.source,
             f.remediation_due_date, f.remediation_plan, c.title AS control_title
      FROM finding f
      LEFT JOIN control c ON c.id = f.control_id
      WHERE f.org_id = ${ctx.orgId} AND f.audit_id = ${id} AND f.deleted_at IS NULL
      ORDER BY
        CASE f.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
    `)) as any[];

    const evidence = (await tx.execute(sql`
      SELECT ae.id, ae.title, ae.description, ae.file_path, ae.created_at,
             ev.file_name AS source_file
      FROM audit_evidence ae
      LEFT JOIN evidence ev ON ev.id = ae.evidence_id
      WHERE ae.audit_id = ${id}
    `)) as any[];

    const workingPapers = (await tx.execute(sql`
      SELECT id, title, status, content_summary, created_at
      FROM audit_working_paper
      WHERE audit_id = ${id}
    `)) as any[];

    const signOffs = (await tx.execute(sql`
      SELECT signer_role, signoff_type, signed_at, comments, chain_hash, previous_chain_hash
      FROM audit_sign_off
      WHERE audit_id = ${id}
      ORDER BY signed_at
    `)) as any[];

    return {
      auditDetail,
      checklist,
      findings,
      evidence,
      workingPapers,
      signOffs,
    };
  });

  const zip = new JSZip();
  const det = data.auditDetail;

  zip.file(
    "README.txt",
    [
      `ARCTOS Audit Pack`,
      `Generated: ${new Date().toISOString()}`,
      `Audit: ${det?.title ?? a.title}`,
      `Type: ${det?.audit_type ?? a.auditType}`,
      `Status: ${det?.status ?? a.status}`,
      `Conclusion: ${det?.conclusion ?? "—"}`,
      `Lead auditor: ${det?.lead_auditor_name ?? "—"}`,
      `Auditee: ${det?.auditee_name ?? "—"}`,
      `Planned: ${det?.planned_start ?? "—"} → ${det?.planned_end ?? "—"}`,
      `Actual:  ${det?.actual_start ?? "—"} → ${det?.actual_end ?? "—"}`,
      ``,
      `Contents:`,
      `- scope.txt`,
      `- checklist.csv (${data.checklist.length} items)`,
      `- findings.csv (${data.findings.length})`,
      `- evidence.csv (${data.evidence.length})`,
      `- working-papers.csv (${data.workingPapers.length})`,
      `- sign-off-chain.txt (${data.signOffs.length} signatures)`,
      det?.report_path ? `- report.pdf` : "",
    ].join("\n"),
  );

  zip.file(
    "scope.txt",
    [
      "Scope description:",
      det?.scope_description ?? "(none)",
      "",
      "Scope processes: " + (det?.scope_processes ?? []).join(", "),
      "Scope departments: " + (det?.scope_departments ?? []).join(", "),
      "Scope frameworks: " + (det?.scope_frameworks ?? []).join(", "),
    ].join("\n"),
  );

  zip.file(
    "checklist.csv",
    [
      "ItemID,Title,Description,Control,Result,RiskRating,Methods,Notes",
      ...data.checklist.map((c: any) =>
        [
          csv(c.id),
          csv(c.title),
          csv(c.description),
          csv(c.control_title),
          csv(c.result),
          csv(c.risk_rating),
          csv(
            (c.method_entries ?? []).map((m: any) => m?.method ?? m).join("|"),
          ),
          csv(c.notes),
        ].join(","),
      ),
    ].join("\n"),
  );

  zip.file(
    "findings.csv",
    [
      "ID,Title,Severity,Status,Source,Control,RemediationDue,RemediationPlan",
      ...data.findings.map((f: any) =>
        [
          csv(f.id),
          csv(f.title),
          csv(f.severity),
          csv(f.status),
          csv(f.source),
          csv(f.control_title),
          csv(f.remediation_due_date),
          csv(f.remediation_plan),
        ].join(","),
      ),
    ].join("\n"),
  );

  zip.file(
    "evidence.csv",
    [
      "ID,Title,Description,FilePath,SourceFile,Created",
      ...data.evidence.map((e: any) =>
        [
          csv(e.id),
          csv(e.title),
          csv(e.description),
          csv(e.file_path),
          csv(e.source_file),
          csv(e.created_at),
        ].join(","),
      ),
    ].join("\n"),
  );

  zip.file(
    "working-papers.csv",
    [
      "ID,Title,Status,Summary,Created",
      ...data.workingPapers.map((w: any) =>
        [
          csv(w.id),
          csv(w.title),
          csv(w.status),
          csv(w.content_summary),
          csv(w.created_at),
        ].join(","),
      ),
    ].join("\n"),
  );

  zip.file(
    "sign-off-chain.txt",
    data.signOffs
      .map(
        (s: any) =>
          `${s.signed_at}  ${s.signoff_type.padEnd(18)} ${s.signer_role.padEnd(20)} chain:${s.chain_hash?.slice(0, 16) ?? ""}\n${s.comments ?? ""}`,
      )
      .join("\n\n"),
  );

  const buf = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
  });
  const safeTitle = (det?.title ?? a.title)
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .slice(0, 50);

  return new Response(buf, {
    status: 200,
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="audit-pack-${safeTitle}-${Date.now()}.zip"`,
    },
  });
}
