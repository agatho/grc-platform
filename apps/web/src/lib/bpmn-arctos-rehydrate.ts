// BPM Overhaul Phase 5 P5: rehydrate DB cross-links from arctos:* attributes
// in incoming BPMN XML. Called on POST /processes/[id]/versions when a new
// version is saved (and on bulk-import).
//
// Insert-only (idempotent via existing FK checks); never deletes existing
// links unless explicitly requested.

import { sql, type SQL } from "drizzle-orm";
import type { GrcMetadata } from "@/components/bpmn/arctos-grc-extractor";
import { parseArctosGrcMetadataMap } from "@/lib/bpmn-arctos-parse";

/** Minimal structural view of a Drizzle db/transaction handle. */
interface SqlExecutor {
  execute(query: SQL): Promise<unknown>;
}

interface RehydrateArgs {
  tx: SqlExecutor;
  processId: string;
  orgId: string;
  userId: string;
  bpmnXml: string;
  stepIdByBpmnElement: Map<string, string>; // pre-loaded mapping
}

export interface RehydrationStats {
  riskLinksAdded: number;
  controlLinksAdded: number;
  documentLinksAdded: number;
  lodAssignments: number;
  ropaProfilesUpdated: number;
}

export async function rehydrateFromBpmnXml(
  args: RehydrateArgs,
): Promise<RehydrationStats> {
  const stats: RehydrationStats = {
    riskLinksAdded: 0,
    controlLinksAdded: 0,
    documentLinksAdded: 0,
    lodAssignments: 0,
    ropaProfilesUpdated: 0,
  };

  // B1.2: real moddle-based XML parsing — the whole document is parsed
  // once and every element carrying an <arctos:grcMetadata> extension is
  // returned with its already-structured metadata.
  const metaByElement = await parseArctosGrcMetadataMap(args.bpmnXml);

  for (const [elementId, meta] of metaByElement) {
    const stepId = args.stepIdByBpmnElement.get(elementId);

    if (stepId && meta.lineOfDefense) {
      await args.tx.execute(sql`
        UPDATE process_step
        SET line_of_defense = ${meta.lineOfDefense}::lod_enum,
            updated_at = now()
        WHERE id = ${stepId}
      `);
      stats.lodAssignments += 1;
    }

    if (stepId && meta.riskRefs?.length) {
      for (const r of meta.riskRefs) {
        if (!r.id) continue;
        // Insert only if pair doesn't exist + the risk exists in this org
        await args.tx.execute(sql`
          INSERT INTO process_step_risk (org_id, risk_id, process_step_id, created_by)
          SELECT ${args.orgId}::uuid, ${r.id}::uuid, ${stepId}::uuid, ${args.userId}::uuid
          WHERE EXISTS (SELECT 1 FROM risk WHERE id = ${r.id}::uuid AND org_id = ${args.orgId}::uuid AND deleted_at IS NULL)
            AND NOT EXISTS (SELECT 1 FROM process_step_risk WHERE process_step_id = ${stepId}::uuid AND risk_id = ${r.id}::uuid)
        `);
        stats.riskLinksAdded += 1;
      }
    }

    if (stepId && meta.controlRefs?.length) {
      for (const c of meta.controlRefs) {
        if (!c.id) continue;
        await args.tx.execute(sql`
          INSERT INTO process_step_control (org_id, control_id, process_step_id, created_by)
          SELECT ${args.orgId}::uuid, ${c.id}::uuid, ${stepId}::uuid, ${args.userId}::uuid
          WHERE EXISTS (SELECT 1 FROM control WHERE id = ${c.id}::uuid AND org_id = ${args.orgId}::uuid AND deleted_at IS NULL)
            AND NOT EXISTS (SELECT 1 FROM process_step_control WHERE process_step_id = ${stepId}::uuid AND control_id = ${c.id}::uuid)
        `);
        stats.controlLinksAdded += 1;
      }
    }

    if (meta.documentRefs?.length) {
      for (const d of meta.documentRefs) {
        if (!d.id) continue;
        await args.tx.execute(sql`
          INSERT INTO process_document (org_id, process_id, document_id, document_type, created_by)
          SELECT ${args.orgId}::uuid, ${args.processId}::uuid, ${d.id}::uuid, ${d.documentType ?? null}, ${args.userId}::uuid
          WHERE EXISTS (SELECT 1 FROM document WHERE id = ${d.id}::uuid AND org_id = ${args.orgId}::uuid AND deleted_at IS NULL)
            AND NOT EXISTS (SELECT 1 FROM process_document WHERE process_id = ${args.processId}::uuid AND document_id = ${d.id}::uuid)
        `);
        stats.documentLinksAdded += 1;
      }
    }

    if (meta.ropa) {
      await args.tx.execute(sql`
        INSERT INTO process_ropa_profile (
          process_id, org_id, is_processing_activity, processing_purpose,
          legal_basis, requires_dpia, created_by
        )
        VALUES (
          ${args.processId}::uuid, ${args.orgId}::uuid,
          ${meta.ropa.isProcessingActivity ?? false},
          ${meta.ropa.purpose ?? null},
          ${meta.ropa.legalBasis ?? null}::ropa_legal_basis,
          ${meta.ropa.requiresDpia ?? false},
          ${args.userId}::uuid
        )
        ON CONFLICT (process_id) DO UPDATE SET
          is_processing_activity = EXCLUDED.is_processing_activity,
          processing_purpose = COALESCE(EXCLUDED.processing_purpose, process_ropa_profile.processing_purpose),
          legal_basis = COALESCE(EXCLUDED.legal_basis, process_ropa_profile.legal_basis),
          requires_dpia = process_ropa_profile.requires_dpia OR EXCLUDED.requires_dpia,
          updated_at = now()
      `);
      stats.ropaProfilesUpdated += 1;
    }
  }

  return stats;
}

/** Build arctos:* serialization from the DB cross-links for export. */
export interface ExportLinks {
  bpmnElementId: string;
  meta: GrcMetadata;
}

interface ExportLinkRow {
  bpmn_element_id: string;
  line_of_defense: string | null;
  risk_refs: NonNullable<GrcMetadata["riskRefs"]> | null;
  control_refs: NonNullable<GrcMetadata["controlRefs"]> | null;
}

export async function buildArctosLinksFromDb(
  tx: SqlExecutor,
  processId: string,
  orgId: string,
): Promise<ExportLinks[]> {
  const rows = (await tx.execute(sql`
    SELECT
      ps.bpmn_element_id,
      ps.line_of_defense,
      (
        SELECT json_agg(json_build_object(
          'id', r.id,
          'title', r.title,
          'inherentScore', r.risk_score_inherent,
          'residualScore', r.risk_score_residual,
          'status', r.status
        ))
        FROM process_step_risk psr
        JOIN risk r ON r.id = psr.risk_id AND r.deleted_at IS NULL
        WHERE psr.process_step_id = ps.id
      ) AS risk_refs,
      (
        SELECT json_agg(json_build_object(
          'id', c.id,
          'title', c.title,
          'effectiveness', c.status,
          'controlType', c.control_type
        ))
        FROM process_step_control psc
        JOIN control c ON c.id = psc.control_id AND c.deleted_at IS NULL
        WHERE psc.process_step_id = ps.id
      ) AS control_refs
    FROM process_step ps
    WHERE ps.process_id = ${processId}::uuid AND ps.deleted_at IS NULL
  `)) as ExportLinkRow[];

  return rows.map((r) => ({
    bpmnElementId: r.bpmn_element_id,
    meta: {
      lineOfDefense: r.line_of_defense ?? undefined,
      riskRefs: r.risk_refs ?? undefined,
      controlRefs: r.control_refs ?? undefined,
    },
  }));
}
