import { db } from "@grc/db";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";
import { log } from "@/lib/logger";

// GET /api/v1/catalogs/mappings — Cross-framework mappings for a specific entry or catalog
// [ARCTOS-FULL-2026-08-31 / Welle 4b · OP-076] Beide Zweige projizieren
// dieselbe Verbund-Zeile; sie ist hier einmal aus der SELECT-Liste benannt.
type MappingRow = {
  mapping_id: string;
  relationship: string | null;
  confidence: string | number | null;
  mapping_source: string | null;
  source_reference: string | null;
  source_code: string | null;
  source_name: string | null;
  source_catalog_name: string | null;
  source_catalog_source: string | null;
  source_catalog_id: string | null;
  target_code: string | null;
  target_name: string | null;
  target_catalog_name: string | null;
  target_catalog_source: string | null;
  target_catalog_id: string | null;
};

export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { searchParams } = new URL(req.url);
  const entryId = searchParams.get("entryId");
  const catalogSource = searchParams.get("catalogSource");

  if (!entryId && !catalogSource) {
    return Response.json(
      { error: "Either entryId or catalogSource query parameter is required" },
      { status: 400 },
    );
  }

  try {
    if (entryId) {
      // Get all mappings for a specific catalog entry (both as source and target)
      const result = await db.execute(sql`
        SELECT
          m.id AS mapping_id,
          m.relationship,
          m.confidence,
          m.mapping_source,
          m.source_reference,
          sce.code AS source_code,
          sce.name AS source_name,
          sc.name AS source_catalog_name,
          sc.source AS source_catalog_source,
          sc.id AS source_catalog_id,
          tce.code AS target_code,
          tce.name AS target_name,
          tc.name AS target_catalog_name,
          tc.source AS target_catalog_source,
          tc.id AS target_catalog_id
        FROM catalog_entry_mapping m
        JOIN catalog_entry sce ON m.source_entry_id = sce.id
        JOIN catalog sc ON sce.catalog_id = sc.id
        JOIN catalog_entry tce ON m.target_entry_id = tce.id
        JOIN catalog tc ON tce.catalog_id = tc.id
        WHERE m.source_entry_id = ${entryId}
           OR m.target_entry_id = ${entryId}
        ORDER BY tc.name, tce.code
      `);

      const data = (result as unknown as MappingRow[]).map((row) => ({
        sourceEntry: {
          code: row.source_code,
          name: row.source_name,
          catalogName: row.source_catalog_name,
          catalogSource: row.source_catalog_source,
          catalogId: row.source_catalog_id,
        },
        targetEntry: {
          code: row.target_code,
          name: row.target_name,
          catalogName: row.target_catalog_name,
          catalogSource: row.target_catalog_source,
          catalogId: row.target_catalog_id,
        },
        relationship: row.relationship,
        confidence: row.confidence,
      }));

      return Response.json({ data });
    }

    // Get all mappings involving entries from a specific catalog (by source key)
    const result = await db.execute(sql`
      SELECT
        m.id AS mapping_id,
        m.relationship,
        m.confidence,
        m.mapping_source,
        m.source_reference,
        sce.code AS source_code,
        sce.name AS source_name,
        sc.name AS source_catalog_name,
        sc.source AS source_catalog_source,
        sc.id AS source_catalog_id,
        tce.code AS target_code,
        tce.name AS target_name,
        tc.name AS target_catalog_name,
        tc.source AS target_catalog_source,
        tc.id AS target_catalog_id
      FROM catalog_entry_mapping m
      JOIN catalog_entry sce ON m.source_entry_id = sce.id
      JOIN catalog sc ON sce.catalog_id = sc.id
      JOIN catalog_entry tce ON m.target_entry_id = tce.id
      JOIN catalog tc ON tce.catalog_id = tc.id
      WHERE sc.source = ${catalogSource}
         OR tc.source = ${catalogSource}
      ORDER BY sce.code, tc.name, tce.code
      LIMIT 500
    `);

    const data = (result as unknown as MappingRow[]).map((row) => ({
      sourceEntry: {
        code: row.source_code,
        name: row.source_name,
        catalogName: row.source_catalog_name,
        catalogSource: row.source_catalog_source,
        catalogId: row.source_catalog_id,
      },
      targetEntry: {
        code: row.target_code,
        name: row.target_name,
        catalogName: row.target_catalog_name,
        catalogSource: row.target_catalog_source,
        catalogId: row.target_catalog_id,
      },
      relationship: row.relationship,
      confidence: row.confidence,
    }));

    return Response.json({ data });
  } catch (error) {
    log.error("[catalogs/mappings] fetch failed", { err: error });
    return Response.json(
      { error: "Failed to fetch mappings" },
      { status: 500 },
    );
  }
});
