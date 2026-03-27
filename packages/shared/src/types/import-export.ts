// Sprint 19: Bulk Import/Export types

export type ImportJobStatus =
  | "uploaded"
  | "mapping"
  | "validating"
  | "validated"
  | "executing"
  | "completed"
  | "failed";

export type ImportEntityType =
  | "risk"
  | "control"
  | "asset"
  | "vendor"
  | "contract"
  | "incident"
  | "process"
  | "ropa_entry";

export type ExportFormat = "csv" | "xlsx" | "pdf";

export interface ImportJob {
  id: string;
  orgId: string;
  entityType: ImportEntityType;
  fileName: string;
  fileSize: number;
  mimeType: string;
  status: ImportJobStatus;
  totalRows: number | null;
  validRows: number | null;
  errorRows: number | null;
  importedRows: number | null;
  columnMapping: Record<string, string | null> | null;
  validationErrors: ValidationError[];
  logJson: ImportLogEntry[];
  rawHeaders: string[];
  rawPreviewRows: Record<string, string>[];
  createdBy: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface ValidationError {
  row: number;
  field?: string;
  error: string;
}

export interface ImportLogEntry {
  rowNumber: number;
  status: "success" | "error";
  entityId?: string;
  error?: string;
}

export interface ColumnMappingTemplate {
  id: string;
  orgId: string;
  entityType: ImportEntityType;
  name: string;
  mappingJson: Record<string, string>;
  createdBy: string | null;
  createdAt: string;
}

export interface ExportSchedule {
  id: string;
  orgId: string;
  name: string;
  entityTypes: ImportEntityType[];
  format: ExportFormat;
  cronExpression: string;
  recipientEmails: string[];
  filters: Record<string, unknown>;
  isActive: string;
  lastRunAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FieldDef {
  name: string;
  type: "string" | "integer" | "number" | "enum" | "boolean" | "date" | "fk";
  aliases: string[];
  enumValues?: readonly string[];
  min?: number;
  max?: number;
  required?: boolean;
}

export interface FKRule {
  field: string;
  lookupTable: string;
  lookupField: string;
  matchType: "exact" | "ilike";
}

export interface EntityDefinition {
  key: ImportEntityType;
  tableName: string;
  requiredFields: FieldDef[];
  optionalFields: FieldDef[];
  fkResolutionRules: FKRule[];
  templateHeaders: string[];
  templateExampleRows: (string | number | boolean)[][];
  uniqueKey: string[];
  exportColumns: { key: string; header: string }[];
}

export interface ValidationResult {
  totalRows: number;
  validRows: number;
  errorRows: number;
  errors: ValidationError[];
  previewRows?: Record<string, unknown>[];
}

export interface ImportResult {
  imported: number;
  failed: number;
  log: ImportLogEntry[];
}
