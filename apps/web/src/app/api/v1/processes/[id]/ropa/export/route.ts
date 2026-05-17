// BPM Overhaul Phase 2 A2: Per-process ROPA export (CSV or PDF).

import { db, organization, process } from "@grc/db";
import { requireModule } from "@grc/auth";
import { and, eq, isNull, sql } from "drizzle-orm";
import { withAuth, withReadContext } from "@/lib/api";
import { rowsToCsv, rowsToHtml, type RopaRow } from "@/lib/ropa-export";
import { renderHtmlToPdfResponse } from "@/lib/pdf";

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
    .select({ id: process.id })
    .from(process)
    .where(and(eq(process.id, id), eq(process.orgId, ctx.orgId), isNull(process.deletedAt)));
  if (!existing) return Response.json({ error: "Process not found" }, { status: 404 });

  const url = new URL(req.url);
  const format = (url.searchParams.get("format") ?? "pdf").toLowerCase();
  if (!["csv", "pdf"].includes(format)) {
    return Response.json({ error: "format must be csv or pdf" }, { status: 400 });
  }

  const rows = await withReadContext(ctx, async (tx) => {
    return (await tx.execute(sql`
      SELECT
        p.id AS "processId",
        p.name AS "processName",
        p.department AS "department",
        prp.processing_purpose AS "processingPurpose",
        prp.legal_basis AS "legalBasis",
        prp.legal_basis_detail AS "legalBasisDetail",
        prp.data_subject_categories AS "dataSubjectCategories",
        prp.personal_data_categories AS "personalDataCategories",
        prp.special_categories AS "specialCategories",
        prp.recipients AS "recipients",
        prp.third_country_transfers AS "thirdCountryTransfers",
        prp.third_country_safeguards AS "thirdCountrySafeguards",
        prp.retention_period_description AS "retentionPeriodDescription",
        prp.retention_period_months AS "retentionPeriodMonths",
        prp.tom_description AS "tomDescription",
        prp.requires_dpia AS "requiresDpia",
        (SELECT o.name FROM organization o WHERE o.id = prp.controller_org_id) AS "controllerOrgName",
        (
          SELECT array_agg(v.name)
          FROM unnest(prp.processor_vendor_ids) vid
          JOIN vendor v ON v.id = vid
        ) AS "processorVendorNames"
      FROM process_ropa_profile prp
      JOIN process p ON p.id = prp.process_id
      WHERE prp.process_id = ${id}
        AND prp.org_id = ${ctx.orgId}
    `)) as unknown as RopaRow[];
  });

  if (rows.length === 0) {
    return Response.json({ error: "No ROPA profile for this process" }, { status: 404 });
  }

  const [org] = await db
    .select({ name: organization.name })
    .from(organization)
    .where(eq(organization.id, ctx.orgId));
  const orgName = org?.name ?? "Organisation";

  if (format === "csv") {
    return new Response(rowsToCsv(rows), {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="ropa-process-${id.slice(0, 8)}.csv"`,
      },
    });
  }
  return renderHtmlToPdfResponse(rowsToHtml(rows, orgName), `ropa-process-${id.slice(0, 8)}`);
}
