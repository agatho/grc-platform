// Sprint 19: Import executor — single DB transaction, all or nothing

import { db } from "@grc/db";
import { sql } from "drizzle-orm";
import type { ImportResult, ImportLogEntry } from "@grc/shared";
import { getEntityDefinition, ENTITY_REGISTRY } from "./entity-registry";

// Security: whitelist of allowed table names (from hardcoded entity registry)
const ALLOWED_TABLES = new Set(Object.values(ENTITY_REGISTRY).map((d) => d.tableName));
import { applyMapping } from "./column-mapper";
import { sanitizeRowValues } from "./csv-sanitizer";
import { resolveFKsForRow, parseBooleanValue } from "./validation-engine";

/**
 * Execute an import in a single database transaction.
 * If ANY row fails, the ENTIRE transaction is rolled back.
 * Returns 0 imported + error details for the failing row.
 */
export async function executeImport(
  rows: Record<string, string>[],
  mapping: Record<string, string | null>,
  entityType: string,
  orgId: string,
  userId: string,
): Promise<ImportResult> {
  const def = getEntityDefinition(entityType);
  if (!def) {
    throw new Error(`Unknown entity type: ${entityType}`);
  }

  const log: ImportLogEntry[] = [];

  try {
    const result = await db.transaction(async (tx) => {
      // Set audit context
      await tx.execute(
        sql`SELECT set_config('app.current_org_id', ${orgId}, true)`,
      );
      await tx.execute(
        sql`SELECT set_config('app.current_user_id', ${userId}, true)`,
      );

      for (let i = 0; i < rows.length; i++) {
        const rowNum = i + 1;
        const rawRow = rows[i];
        const mapped = applyMapping(rawRow, mapping);

        // Resolve FK fields
        const resolved = await resolveFKsForRow(
          mapped,
          def.fkResolutionRules,
          orgId,
        );

        // Sanitize string values for CSV injection prevention
        const sanitized = sanitizeRowValues(resolved);

        // Convert field names from snake_case to match DB columns
        const dbRow = buildDbRow(sanitized, entityType, orgId);

        // Security: validate table name against whitelist
        if (!ALLOWED_TABLES.has(def.tableName)) {
          throw new Error(`SECURITY: Table "${def.tableName}" not in allowed import targets`);
        }
        // Insert into the entity table
        const insertResult = await tx.execute(
          sql`INSERT INTO ${sql.raw(def.tableName)} ${buildInsertSql(dbRow)} RETURNING id`,
        );

        const entityId = ((insertResult as unknown as { id: string }[])[0])?.id;

        log.push({
          rowNumber: rowNum,
          status: "success",
          entityId,
        });
      }

      return { imported: log.length, failed: 0, log };
    });

    return result;
  } catch (err) {
    // Transaction was rolled back — find which row caused the error
    const errorMessage =
      err instanceof Error ? err.message : String(err);

    // Add error entry for the failing row
    const failedRowIndex = log.length;
    log.push({
      rowNumber: failedRowIndex + 1,
      status: "error",
      error: errorMessage,
    });

    return {
      imported: 0,
      failed: rows.length,
      log,
    };
  }
}

/**
 * Build a DB-ready row object from sanitized import data.
 * Adds org_id and converts types as needed.
 */
function buildDbRow(
  sanitized: Record<string, unknown>,
  entityType: string,
  orgId: string,
): Record<string, unknown> {
  const def = getEntityDefinition(entityType)!;
  const dbRow: Record<string, unknown> = { org_id: orgId };

  const allFields = [...def.requiredFields, ...def.optionalFields];

  for (const [key, value] of Object.entries(sanitized)) {
    if (key === "org_id") continue;
    if (value === undefined || value === null || value === "") continue;

    const fieldDef = allFields.find((f) => f.name === key);

    if (fieldDef) {
      switch (fieldDef.type) {
        case "integer":
          dbRow[key] = Number(value);
          break;
        case "number":
          dbRow[key] = Number(value);
          break;
        case "boolean":
          dbRow[key] = typeof value === "string"
            ? parseBooleanValue(value)
            : Boolean(value);
          break;
        default:
          dbRow[key] = value;
      }
    } else {
      // FK-resolved fields (like owner_id) won't be in field defs
      dbRow[key] = value;
    }
  }

  return dbRow;
}

/**
 * Build a raw SQL INSERT clause from a key-value record.
 */
const VALID_COLUMN_RE = /^[a-z_][a-z0-9_]*$/;

function buildInsertSql(row: Record<string, unknown>) {
  const keys = Object.keys(row);
  // Defense-in-depth: validate column names are safe identifiers
  for (const k of keys) {
    if (!VALID_COLUMN_RE.test(k)) {
      throw new Error(`SECURITY: Invalid column name rejected: "${k}"`);
    }
  }
  const columns = keys.map((k) => sql.raw(`"${k}"`));
  const values = keys.map((k) => {
    const v = row[k];
    if (v === null || v === undefined) return sql`NULL`;
    if (typeof v === "number") return sql`${v}`;
    if (typeof v === "boolean") return sql`${v}`;
    return sql`${String(v)}`;
  });

  return sql`(${sql.join(columns, sql`, `)}) VALUES (${sql.join(values, sql`, `)})`;
}
