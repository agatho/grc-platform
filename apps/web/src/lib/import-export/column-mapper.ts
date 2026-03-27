// Sprint 19: Column auto-detection + mapping engine

import type { EntityDefinition, FieldDef } from "@grc/shared";
import { getEntityDefinition } from "./entity-registry";

export interface ColumnMappingResult {
  /** Map of CSV header → DB field name (or null if unmapped) */
  mapping: Record<string, string | null>;
  /** CSV headers that could not be auto-detected */
  unmappedHeaders: string[];
  /** Required DB fields that are not yet mapped */
  unmappedRequired: string[];
  /** Whether all required fields are mapped */
  isValid: boolean;
}

/**
 * Auto-detect column mapping by matching CSV headers against
 * entity field aliases (case-insensitive, DE + EN).
 */
export function autoDetectMapping(
  headers: string[],
  entityType: string,
): ColumnMappingResult {
  const def = getEntityDefinition(entityType);
  if (!def) {
    throw new Error(`Unknown entity type: ${entityType}`);
  }

  const allFields = [...def.requiredFields, ...def.optionalFields];
  const mapping: Record<string, string | null> = {};
  const mappedFields = new Set<string>();

  for (const header of headers) {
    const normalizedHeader = header.toLowerCase().trim();
    const match = allFields.find(
      (f) =>
        !mappedFields.has(f.name) &&
        f.aliases.some((a) => a.toLowerCase() === normalizedHeader),
    );
    if (match) {
      mapping[header] = match.name;
      mappedFields.add(match.name);
    } else {
      mapping[header] = null;
    }
  }

  const unmappedHeaders = headers.filter((h) => mapping[h] === null);
  const unmappedRequired = def.requiredFields
    .filter((f) => !mappedFields.has(f.name))
    .map((f) => f.name);

  return {
    mapping,
    unmappedHeaders,
    unmappedRequired,
    isValid: unmappedRequired.length === 0,
  };
}

/**
 * Apply a column mapping to a raw row, converting CSV header keys
 * to DB field names.
 */
export function applyMapping(
  row: Record<string, string>,
  mapping: Record<string, string | null>,
): Record<string, string> {
  const mapped: Record<string, string> = {};
  for (const [csvHeader, dbField] of Object.entries(mapping)) {
    if (dbField && row[csvHeader] !== undefined) {
      mapped[dbField] = row[csvHeader].trim();
    }
  }
  return mapped;
}

/**
 * Get field definition by DB field name from an entity definition.
 */
export function getFieldDef(
  entityDef: EntityDefinition,
  fieldName: string,
): FieldDef | undefined {
  return [...entityDef.requiredFields, ...entityDef.optionalFields].find(
    (f) => f.name === fieldName,
  );
}
