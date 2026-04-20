// Sprint 28: Entity field definitions for the condition builder UI
// Maps entity types to their available fields with labels and types

import type { EntityFieldOption, EntityFieldMap } from "@grc/shared";

/**
 * Available fields per entity type for condition building.
 * Used by the frontend condition builder to populate field dropdowns.
 */
export const ENTITY_FIELD_MAP: EntityFieldMap = {
  risk: [
    { field: "residual_score", label: "Residual Score", type: "number" },
    { field: "inherent_score", label: "Inherent Score", type: "number" },
    {
      field: "treatment_strategy",
      label: "Treatment Strategy",
      type: "string",
    },
    { field: "status", label: "Status", type: "string" },
    { field: "title", label: "Title", type: "string" },
    { field: "category", label: "Category", type: "string" },
    { field: "owner_id", label: "Owner", type: "string" },
    { field: "updated_at", label: "Last Updated", type: "date" },
  ],
  control: [
    { field: "ces", label: "Control Effectiveness Score", type: "number" },
    { field: "status", label: "Status", type: "string" },
    { field: "title", label: "Title", type: "string" },
    { field: "test_frequency", label: "Test Frequency", type: "string" },
    { field: "last_tested_at", label: "Last Tested", type: "date" },
    { field: "automation_level", label: "Automation Level", type: "string" },
    { field: "updated_at", label: "Last Updated", type: "date" },
  ],
  finding: [
    { field: "severity", label: "Severity", type: "string" },
    { field: "status", label: "Status", type: "string" },
    { field: "title", label: "Title", type: "string" },
    { field: "due_date", label: "Due Date", type: "date" },
    { field: "updated_at", label: "Last Updated", type: "date" },
  ],
  vendor: [
    { field: "tier", label: "Vendor Tier", type: "string" },
    { field: "name", label: "Vendor Name", type: "string" },
    { field: "status", label: "Status", type: "string" },
    { field: "last_dd_at", label: "Last Due Diligence", type: "date" },
    { field: "risk_score", label: "Risk Score", type: "number" },
    { field: "updated_at", label: "Last Updated", type: "date" },
  ],
  incident: [
    { field: "severity", label: "Severity", type: "string" },
    { field: "status", label: "Status", type: "string" },
    { field: "title", label: "Title", type: "string" },
    { field: "is_data_breach", label: "Is Data Breach", type: "boolean" },
    { field: "detected_at", label: "Detected At", type: "date" },
    { field: "updated_at", label: "Last Updated", type: "date" },
  ],
  document: [
    { field: "status", label: "Status", type: "string" },
    { field: "title", label: "Title", type: "string" },
    { field: "overdue_count", label: "Overdue Count", type: "number" },
    { field: "updated_at", label: "Last Updated", type: "date" },
  ],
  dsr: [
    { field: "status", label: "Status", type: "string" },
    { field: "title", label: "Title", type: "string" },
    { field: "deadline", label: "Deadline", type: "date" },
    { field: "request_type", label: "Request Type", type: "string" },
    { field: "updated_at", label: "Last Updated", type: "date" },
  ],
  data_breach: [
    { field: "status", label: "Status", type: "string" },
    { field: "title", label: "Title", type: "string" },
    { field: "severity", label: "Severity", type: "string" },
    {
      field: "notification_deadline",
      label: "Notification Deadline",
      type: "date",
    },
    { field: "updated_at", label: "Last Updated", type: "date" },
  ],
  audit: [
    { field: "status", label: "Status", type: "string" },
    { field: "title", label: "Title", type: "string" },
    { field: "finding_count", label: "Finding Count", type: "number" },
    { field: "updated_at", label: "Last Updated", type: "date" },
  ],
  esg_metric: [
    { field: "completeness", label: "Completeness (%)", type: "number" },
    { field: "status", label: "Status", type: "string" },
    { field: "deadline", label: "Deadline", type: "date" },
    { field: "updated_at", label: "Last Updated", type: "date" },
  ],
  process: [
    { field: "status", label: "Status", type: "string" },
    { field: "title", label: "Title", type: "string" },
    { field: "maturity_level", label: "Maturity Level", type: "number" },
    { field: "updated_at", label: "Last Updated", type: "date" },
  ],
  asset: [
    { field: "status", label: "Status", type: "string" },
    { field: "name", label: "Name", type: "string" },
    { field: "protection_level", label: "Protection Level", type: "string" },
    { field: "updated_at", label: "Last Updated", type: "date" },
  ],
};

/**
 * Get available fields for a given entity type.
 */
export function getEntityFields(entityType: string): EntityFieldOption[] {
  return ENTITY_FIELD_MAP[entityType] ?? [];
}

/**
 * Get all available entity types.
 */
export function getAvailableEntityTypes(): string[] {
  return Object.keys(ENTITY_FIELD_MAP);
}
