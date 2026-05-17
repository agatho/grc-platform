// BPM Overhaul Phase 2 A2: Org-wide ROPA export derived from process_ropa_profile.
//
// Distinct from /api/v1/dpms/ropa/export which exports ropa_entry rows;
// this endpoint covers processes that are marked as processing activities.

import { db, organization } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, sql } from "drizzle-orm";
import { withAuth, withReadContext } from "@/lib/api";
import { rowsToCsv, rowsToHtml, type RopaRow } from "@/lib/ropa-export";
import { renderHtmlToPdfResponse } from "@/lib/pdf";

export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  // ROPA exports require both BPM and DPMS visibility in practice
  const m = await requireModule("dpms", ctx.orgId, req.method);
  if (m) return m;

  const url = new URL(req.url);
  const format = (url.searchParams.get("format") ?? "csv").toLowerCase();
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
      JOIN process p ON p.id = prp.process_id AND p.deleted_at IS NULL
      WHERE prp.org_id = ${ctx.orgId}
        AND prp.is_processing_activity = true
      ORDER BY p.department NULLS LAST, p.name
    `)) as unknown as RopaRow[];
  });

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
        "content-disposition": `attachment; filename="process-ropa-${ctx.orgId.slice(0, 8)}.csv"`,
      },
    });
  }
  return renderHtmlToPdfResponse(rowsToHtml(rows, orgName), `process-ropa-${ctx.orgId.slice(0, 8)}`);
}
