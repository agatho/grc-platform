// Sprint 22: Where-Used + Event Bus types

// ─── Entity Reference (Where-Used) ──────────────────────────

export type EntityType =
  | "risk"
  | "control"
  | "process"
  | "process_step"
  | "asset"
  | "vendor"
  | "contract"
  | "document"
  | "finding"
  | "incident"
  | "audit"
  | "kri"
  | "bcp"
  | "ropa_entry"
  | "dpia";

export type ReferenceRelationship =
  | "mitigates"
  | "linked_to"
  | "depends_on"
  | "owned_by"
  | "documented_in"
  | "tested_by"
  | "assessed_in"
  | "affects"
  | "implemented_in"
  | "found_in"
  | "bound_by"
  | "affected";

export interface EntityReference {
  id: string;
  orgId: string;
  sourceType: string;
  sourceId: string;
  targetType: string;
  targetId: string;
  relationship: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface ReferenceWithLabel extends EntityReference {
  label?: string;
  elementId?: string;
}

export interface ImpactNode {
  entityType: string;
  entityId: string;
  label?: string;
  elementId?: string;
  relationship: string;
  depth: number;
  children: ImpactNode[];
}

export interface ReferenceStats {
  entityType: string;
  referenceCount: number;
}

// ─── Event Bus ──────────────────────────────────────────────

export type GrcEventType =
  | "entity.created"
  | "entity.updated"
  | "entity.deleted"
  | "entity.status_changed";

export interface GrcEvent {
  orgId: string;
  eventType: GrcEventType;
  entityType: string;
  entityId: string;
  userId?: string;
  payload: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    changedFields?: string[];
  };
  emittedAt: string;
}

export interface EventLogEntry {
  id: string;
  orgId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  userId?: string;
  payload: Record<string, unknown>;
  emittedAt: string;
}

// ─── Webhooks ───────────────────────────────────────────────

export type WebhookTemplateType = "generic" | "slack" | "teams";

export type WebhookDeliveryStatus = "pending" | "delivered" | "failed" | "retrying";

export interface EventFilter {
  entityTypes?: string[];
  events?: string[];
}

export interface WebhookRegistrationData {
  id: string;
  orgId: string;
  name: string;
  url: string;
  secretLast4: string;
  eventFilter: EventFilter;
  headers?: Record<string, string>;
  isActive: boolean;
  templateType?: WebhookTemplateType;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDeliveryLogEntry {
  id: string;
  webhookId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  responseStatus?: number;
  responseBody?: string;
  deliveredAt?: string;
  retryCount: number;
  nextRetryAt?: string;
  status: WebhookDeliveryStatus;
  errorMessage?: string;
  createdAt: string;
}

export interface WebhookStats {
  totalDeliveries: number;
  successCount: number;
  failedCount: number;
  avgLatencyMs?: number;
  last24hDeliveries: number;
}

// ─── Available Event Types for filter UI ────────────────────

export const AVAILABLE_ENTITY_TYPES: EntityType[] = [
  "risk",
  "control",
  "process",
  "asset",
  "vendor",
  "contract",
  "document",
  "finding",
  "incident",
  "audit",
  "kri",
  "bcp",
  "ropa_entry",
  "dpia",
];

export const AVAILABLE_EVENT_TYPES: GrcEventType[] = [
  "entity.created",
  "entity.updated",
  "entity.deleted",
  "entity.status_changed",
];
