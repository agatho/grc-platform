// Sprint 29: Batch entity enrichment — one query per entity type, never N+1
import { db } from "@grc/db";
import { sql } from "drizzle-orm";
import type { GraphNode, GraphResult } from "./types";

interface EntityDetail {
  id: string;
  name: string;
  status?: string;
  severity?: string;
  elementId?: string;
}

// Entity type -> table name + columns mapping
const ENTITY_TABLE_MAP: Record<string, { table: string; nameCol: string; statusCol?: string; severityCol?: string; elementIdCol?: string }> = {
  risk: { table: "risk", nameCol: "title", statusCol: "status", severityCol: "inherent_severity", elementIdCol: "element_id" },
  control: { table: "control", nameCol: "title", statusCol: "status", elementIdCol: "element_id" },
  asset: { table: "asset", nameCol: "name", statusCol: "status", elementIdCol: "element_id" },
  process: { table: "process", nameCol: "name", statusCol: "status", elementIdCol: "element_id" },
  vendor: { table: "vendor", nameCol: "name", statusCol: "status", elementIdCol: "element_id" },
  document: { table: "document", nameCol: "title", statusCol: "status", elementIdCol: "element_id" },
  finding: { table: "finding", nameCol: "title", statusCol: "status", severityCol: "severity", elementIdCol: "element_id" },
  incident: { table: "incident", nameCol: "title", statusCol: "status", severityCol: "severity", elementIdCol: "element_id" },
  audit: { table: "audit", nameCol: "title", statusCol: "status" },
  kri: { table: "kri", nameCol: "name", statusCol: "status" },
  bcp: { table: "bcp", nameCol: "name", statusCol: "status" },
  ropa_entry: { table: "ropa_entry", nameCol: "processing_name", statusCol: "status" },
  dpia: { table: "dpia", nameCol: "title", statusCol: "status" },
  contract: { table: "contract", nameCol: "title", statusCol: "status" },
  process_step: { table: "process_step", nameCol: "name" },
};

/**
 * Batch-fetch entity details per type (one query per entity type, not per node).
 * Enriches GraphResult nodes with name, status, severity.
 */
export async function enrichGraphNodes(graph: GraphResult): Promise<GraphResult> {
  // Group node IDs by type
  const nodesByType = new Map<string, string[]>();
  for (const node of graph.nodes) {
    const existing = nodesByType.get(node.type) ?? [];
    existing.push(node.id);
    nodesByType.set(node.type, existing);
  }

  // Batch-fetch each type (one query per type)
  const detailsMap = new Map<string, EntityDetail>();

  const fetchPromises = Array.from(nodesByType.entries()).map(
    async ([entityType, ids]) => {
      const tableConfig = ENTITY_TABLE_MAP[entityType];
      if (!tableConfig || ids.length === 0) return;

      try {
        const idList = ids.map((id) => `'${id}'`).join(",");
        const selectCols = [
          `id::text as id`,
          `${tableConfig.nameCol} as name`,
          tableConfig.statusCol ? `${tableConfig.statusCol} as status` : `NULL as status`,
          tableConfig.severityCol ? `${tableConfig.severityCol} as severity` : `NULL as severity`,
          tableConfig.elementIdCol ? `${tableConfig.elementIdCol} as element_id` : `NULL as element_id`,
        ].join(", ");

        const rows = await db.execute(
          sql.raw(`SELECT ${selectCols} FROM ${tableConfig.table} WHERE id IN (${idList})`),
        );

        for (const row of rows as unknown as Array<{ id: string; name: string; status?: string; severity?: string; element_id?: string }>) {
          detailsMap.set(row.id, {
            id: row.id,
            name: row.name ?? row.id,
            status: row.status ?? undefined,
            severity: row.severity ?? undefined,
            elementId: row.element_id ?? undefined,
          });
        }
      } catch {
        // Table might not exist or columns differ — use fallback names
        for (const id of ids) {
          if (!detailsMap.has(id)) {
            detailsMap.set(id, { id, name: `${entityType}:${id.slice(0, 8)}` });
          }
        }
      }
    },
  );

  await Promise.all(fetchPromises);

  // Enrich nodes
  const enrichedNodes: GraphNode[] = graph.nodes.map((node) => {
    const detail = detailsMap.get(node.id);
    return {
      ...node,
      name: detail?.name ?? `${node.type}:${node.id.slice(0, 8)}`,
      status: detail?.status,
      severity: detail?.severity,
    };
  });

  return {
    ...graph,
    nodes: enrichedNodes,
  };
}

/**
 * Fetch a single entity's display name.
 */
export async function getEntityName(
  entityType: string,
  entityId: string,
): Promise<string> {
  const tableConfig = ENTITY_TABLE_MAP[entityType];
  if (!tableConfig) return `${entityType}:${entityId.slice(0, 8)}`;

  try {
    const rows = await db.execute(
      sql.raw(
        `SELECT ${tableConfig.nameCol} as name FROM ${tableConfig.table} WHERE id = '${entityId}' LIMIT 1`,
      ),
    );
    const row = (rows as unknown as Array<{ name: string }>)[0];
    return row?.name ?? `${entityType}:${entityId.slice(0, 8)}`;
  } catch {
    return `${entityType}:${entityId.slice(0, 8)}`;
  }
}
