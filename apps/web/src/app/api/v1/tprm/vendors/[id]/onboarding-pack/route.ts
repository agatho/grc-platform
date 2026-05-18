// TPRM Overhaul: vendor onboarding pack (ZIP).

import JSZip from "jszip";
import { db, vendor } from "@grc/db";
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
  const ctx = await withAuth("admin", "vendor_manager", "compliance_officer");
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("tprm", ctx.orgId, req.method);
  if (m) return m;

  const { id } = await params;
  const [v] = await db
    .select()
    .from(vendor)
    .where(
      and(
        eq(vendor.id, id),
        eq(vendor.orgId, ctx.orgId),
        isNull(vendor.deletedAt),
      ),
    );
  if (!v) return Response.json({ error: "Vendor not found" }, { status: 404 });

  const data = await withReadContext(ctx, async (tx) => {
    const dd = (await tx.execute(sql`
      SELECT dd.id, dd.title, dd.status, dd.start_date, dd.completed_date, dd.overall_score
      FROM vendor_due_diligence dd
      WHERE dd.vendor_id = ${id}
      ORDER BY dd.start_date DESC NULLS LAST
    `)) as any[];

    const contracts = (await tx.execute(sql`
      SELECT id, title, contract_type, status, start_date, end_date, value_amount, value_currency
      FROM contract
      WHERE vendor_id = ${id} AND deleted_at IS NULL
    `)) as any[];

    const scorecards = (await tx.execute(sql`
      SELECT id, scoring_period, overall_score, quality_score, sla_score, security_score, financial_score
      FROM vendor_scorecard
      WHERE vendor_id = ${id}
      ORDER BY scoring_period DESC
      LIMIT 12
    `)) as any[];

    const subProcessors = (await tx.execute(sql`
      SELECT id, sub_processor_name, country, services_provided, status
      FROM vendor_sub_processor
      WHERE vendor_id = ${id}
    `)) as any[];

    const lksg = (await tx.execute(sql`
      SELECT id, assessment_date, status, risk_categories
      FROM lksg_assessment
      WHERE vendor_id = ${id}
    `)) as any[];

    const signOffs = (await tx.execute(sql`
      SELECT signer_role, signoff_type, signed_at, comments, chain_hash
      FROM vendor_sign_off
      WHERE vendor_id = ${id}
      ORDER BY signed_at
    `)) as any[];

    return { dd, contracts, scorecards, subProcessors, lksg, signOffs };
  });

  const zip = new JSZip();

  zip.file(
    "README.txt",
    [
      `ARCTOS Vendor Onboarding Pack`,
      `Generated: ${new Date().toISOString()}`,
      `Vendor: ${v.name}`,
      `Legal name: ${v.legalName ?? "—"}`,
      `Tier: ${v.tier}`,
      `Status: ${v.status}`,
      `Country: ${v.country ?? "—"}`,
      `DORA critical-ICT: ${v.doraCriticalIct ? "YES" : "no"}`,
      `LkSG tier-1: ${v.lksgTier1 ? "YES" : "no"}`,
      `Designation rationale: ${v.designationRationale ?? "—"}`,
      ``,
      `Contents:`,
      `- due-diligence.csv (${data.dd.length})`,
      `- contracts.csv (${data.contracts.length})`,
      `- scorecards.csv (${data.scorecards.length})`,
      `- sub-processors.csv (${data.subProcessors.length})`,
      `- lksg-assessments.csv (${data.lksg.length})`,
      `- sign-off-chain.txt (${data.signOffs.length})`,
    ].join("\n"),
  );

  zip.file(
    "due-diligence.csv",
    [
      "ID,Title,Status,Start,Completed,Score",
      ...data.dd.map((d: any) =>
        [
          csv(d.id),
          csv(d.title),
          csv(d.status),
          csv(d.start_date),
          csv(d.completed_date),
          csv(d.overall_score),
        ].join(","),
      ),
    ].join("\n"),
  );

  zip.file(
    "contracts.csv",
    [
      "ID,Title,Type,Status,Start,End,Value,Currency",
      ...data.contracts.map((c: any) =>
        [
          csv(c.id),
          csv(c.title),
          csv(c.contract_type),
          csv(c.status),
          csv(c.start_date),
          csv(c.end_date),
          csv(c.value_amount),
          csv(c.value_currency),
        ].join(","),
      ),
    ].join("\n"),
  );

  zip.file(
    "scorecards.csv",
    [
      "Period,Overall,Quality,SLA,Security,Financial",
      ...data.scorecards.map((s: any) =>
        [
          csv(s.scoring_period),
          csv(s.overall_score),
          csv(s.quality_score),
          csv(s.sla_score),
          csv(s.security_score),
          csv(s.financial_score),
        ].join(","),
      ),
    ].join("\n"),
  );

  zip.file(
    "sub-processors.csv",
    [
      "Name,Country,Services,Status",
      ...data.subProcessors.map((s: any) =>
        [
          csv(s.sub_processor_name),
          csv(s.country),
          csv(s.services_provided),
          csv(s.status),
        ].join(","),
      ),
    ].join("\n"),
  );

  zip.file(
    "lksg-assessments.csv",
    [
      "AssessmentDate,Status,RiskCategories",
      ...data.lksg.map((l: any) =>
        [csv(l.assessment_date), csv(l.status), csv(l.risk_categories)].join(
          ",",
        ),
      ),
    ].join("\n"),
  );

  zip.file(
    "sign-off-chain.txt",
    data.signOffs
      .map(
        (s: any) =>
          `${s.signed_at}  ${s.signoff_type.padEnd(12)} ${s.signer_role.padEnd(20)} chain:${s.chain_hash?.slice(0, 16) ?? ""}\n${s.comments ?? ""}`,
      )
      .join("\n\n"),
  );

  const buf = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });
  const slug = v.name.replace(/[^A-Za-z0-9_-]+/g, "-").slice(0, 50);

  return new Response(buf, {
    status: 200,
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="vendor-pack-${slug}-${Date.now()}.zip"`,
    },
  });
}
