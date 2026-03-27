// Sprint 19: Row validation engine — Zod schema per row, required fields,
// enum checking, FK resolution, duplicate detection

import { db } from "@grc/db";
import { sql } from "drizzle-orm";
import type {
  EntityDefinition,
  ValidationError,
  ValidationResult,
  FKRule,
} from "@grc/shared";
import { getEntityDefinition } from "./entity-registry";
import { applyMapping, getFieldDef } from "./column-mapper";
import { sanitizeCsvValue } from "./csv-sanitizer";

/**
 * Validate all rows against entity definition rules.
 * Returns a summary with errors per row.
 */
export async function validateRows(
  rows: Record<string, string>[],
  mapping: Record<string, string | null>,
  entityType: string,
  orgId: string,
): Promise<ValidationResult> {
  const def = getEntityDefinition(entityType);
  if (!def) {
    throw new Error(`Unknown entity type: ${entityType}`);
  }

  const errors: ValidationError[] = [];
  const seenKeys = new Map<string, number>();
  const previewRows: Record<string, unknown>[] = [];

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 1;
    const rawRow = rows[i];
    const mapped = applyMapping(rawRow, mapping);

    // 1. Required field check
    for (const reqField of def.requiredFields) {
      const value = mapped[reqField.name];
      if (!value || value.trim() === "") {
        errors.push({
          row: rowNum,
          field: reqField.name,
          error: `${reqField.name} is required`,
        });
      }
    }

    // 2. Type/enum validation per field
    const allFields = [...def.requiredFields, ...def.optionalFields];
    for (const field of allFields) {
      const value = mapped[field.name];
      if (!value || value.trim() === "") continue;

      if (field.type === "enum" && field.enumValues) {
        if (!field.enumValues.includes(value)) {
          errors.push({
            row: rowNum,
            field: field.name,
            error: `Invalid value '${value}'. Allowed: ${field.enumValues.join(", ")}`,
          });
        }
      }

      if (field.type === "integer") {
        const num = Number(value);
        if (!Number.isInteger(num)) {
          errors.push({
            row: rowNum,
            field: field.name,
            error: `'${value}' is not a valid integer`,
          });
        } else {
          if (field.min !== undefined && num < field.min) {
            errors.push({
              row: rowNum,
              field: field.name,
              error: `Value ${num} is below minimum ${field.min}`,
            });
          }
          if (field.max !== undefined && num > field.max) {
            errors.push({
              row: rowNum,
              field: field.name,
              error: `Value ${num} exceeds maximum ${field.max}`,
            });
          }
        }
      }

      if (field.type === "number") {
        if (isNaN(Number(value))) {
          errors.push({
            row: rowNum,
            field: field.name,
            error: `'${value}' is not a valid number`,
          });
        }
      }

      if (field.type === "boolean") {
        const lower = value.toLowerCase();
        if (
          !["true", "false", "1", "0", "ja", "nein", "yes", "no"].includes(
            lower,
          )
        ) {
          errors.push({
            row: rowNum,
            field: field.name,
            error: `'${value}' is not a valid boolean (true/false/ja/nein)`,
          });
        }
      }

      if (field.type === "date") {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(value)) {
          errors.push({
            row: rowNum,
            field: field.name,
            error: `'${value}' is not a valid date (expected YYYY-MM-DD)`,
          });
        }
      }
    }

    // 3. FK resolution validation
    for (const rule of def.fkResolutionRules) {
      const value = mapped[rule.field];
      if (!value || value.trim() === "") continue;

      const result = await resolveFK(rule, value, orgId);
      if (!result.success) {
        errors.push({
          row: rowNum,
          field: rule.field,
          error: result.error,
        });
      }
    }

    // 4. Duplicate detection within file
    const uniqueKeyValues = def.uniqueKey
      .filter((k) => k !== "org_id")
      .map((k) => {
        // Try camelCase and snake_case
        return (mapped[k] ?? "").toLowerCase();
      })
      .join("|");

    if (uniqueKeyValues) {
      const existingRow = seenKeys.get(uniqueKeyValues);
      if (existingRow !== undefined) {
        errors.push({
          row: rowNum,
          error: `Duplicate within file: same key as row ${existingRow}`,
        });
      } else {
        seenKeys.set(uniqueKeyValues, rowNum);
      }
    }

    // 5. Duplicate detection against existing DB data
    const titleField = def.uniqueKey.find((k) => k !== "org_id") ?? "title";
    const titleValue = mapped[titleField];
    if (titleValue) {
      const existing = await checkDuplicateInDb(
        def.tableName,
        titleField,
        titleValue,
        orgId,
      );
      if (existing) {
        errors.push({
          row: rowNum,
          error: `Duplicate: '${titleValue}' already exists in database`,
        });
      }
    }

    // Collect preview (first 10)
    if (i < 10) {
      previewRows.push(mapped);
    }
  }

  const errorRowNums = new Set(errors.map((e) => e.row));

  return {
    totalRows: rows.length,
    validRows: rows.length - errorRowNums.size,
    errorRows: errorRowNums.size,
    errors,
    previewRows,
  };
}

// ──────────────────────────────────────────────────────────────
// FK Resolution
// ──────────────────────────────────────────────────────────────

interface FKResolutionResult {
  success: boolean;
  id?: string;
  error: string;
}

export async function resolveFK(
  rule: FKRule,
  value: string,
  orgId: string,
): Promise<FKResolutionResult> {
  try {
    const matchCondition =
      rule.matchType === "ilike"
        ? sql`LOWER(${sql.raw(rule.lookupField)}) = LOWER(${value})`
        : sql`${sql.raw(rule.lookupField)} = ${value}`;

    // For user table, no org_id filter needed (users are global)
    const orgFilter =
      rule.lookupTable === "user"
        ? sql`1=1`
        : sql`org_id = ${orgId}`;

    const result = await db.execute(
      sql`SELECT id FROM ${sql.raw(rule.lookupTable)}
          WHERE ${matchCondition}
          AND ${orgFilter}
          LIMIT 3`,
    );

    const rows = result as unknown as { id: string }[];

    if (rows.length === 0) {
      return {
        success: false,
        error: `No match found for '${value}' in ${rule.lookupTable}`,
      };
    }

    if (rows.length > 1) {
      return {
        success: false,
        error: `Ambiguous: ${rows.length} matches found for '${value}' in ${rule.lookupTable}`,
      };
    }

    return { success: true, id: rows[0].id, error: "" };
  } catch (err) {
    return {
      success: false,
      error: `FK resolution error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Resolve all FK fields in a mapped row. Returns the row with FK fields
 * replaced by resolved UUIDs.
 */
export async function resolveFKsForRow(
  mapped: Record<string, string>,
  fkRules: FKRule[],
  orgId: string,
): Promise<Record<string, unknown>> {
  const resolved: Record<string, unknown> = { ...mapped };

  for (const rule of fkRules) {
    const value = mapped[rule.field];
    if (!value || value.trim() === "") {
      delete resolved[rule.field];
      continue;
    }

    const result = await resolveFK(rule, value, orgId);
    if (result.success && result.id) {
      // Replace the text field with the resolved UUID
      // Map field name to the FK column (e.g. owner_email → owner_id)
      const fkColumnName = rule.field.replace(/_email$/, "_id").replace(/_name$/, "_id");
      resolved[fkColumnName] = result.id;
      delete resolved[rule.field];
    } else {
      throw new Error(`Row FK resolution failed: ${result.error}`);
    }
  }

  return resolved;
}

// ──────────────────────────────────────────────────────────────
// Duplicate detection in DB
// ──────────────────────────────────────────────────────────────

async function checkDuplicateInDb(
  tableName: string,
  field: string,
  value: string,
  orgId: string,
): Promise<boolean> {
  try {
    const result = await db.execute(
      sql`SELECT id FROM ${sql.raw(tableName)}
          WHERE LOWER(${sql.raw(field)}) = LOWER(${value})
          AND org_id = ${orgId}
          LIMIT 1`,
    );
    return (result as unknown as unknown[]).length > 0;
  } catch {
    // Table might not have the field, ignore
    return false;
  }
}

/**
 * Parse boolean-like strings to actual booleans.
 */
export function parseBooleanValue(value: string): boolean {
  const lower = value.toLowerCase().trim();
  return ["true", "1", "ja", "yes"].includes(lower);
}
