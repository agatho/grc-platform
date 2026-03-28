// Sprint 28: GRC Workflow Automation Engine types

// ─── Trigger Types ──────────────────────────────────────────

export type AutomationTriggerType =
  | "entity_change"
  | "deadline_expired"
  | "score_threshold"
  | "periodic";

export type AutomationEventType =
  | "created"
  | "updated"
  | "deleted"
  | "status_changed";

export interface AutomationTriggerConfig {
  entityType: string;
  events?: AutomationEventType[];
  field?: string;
  schedule?: string; // cron for periodic
}

// ─── Condition Types ────────────────────────────────────────

export type ConditionOperator = "AND" | "OR";

export type ConditionComparisonOp =
  | ">"
  | "<"
  | "="
  | "!="
  | "contains"
  | "not_contains"
  | "days_since"
  | ">="
  | "<=";

export interface ConditionRule {
  field: string;
  op: ConditionComparisonOp;
  value: string | number | boolean;
}

export interface ConditionGroup {
  operator: ConditionOperator;
  rules: (ConditionRule | ConditionGroup)[];
}

// ─── Action Types ───────────────────────────────────────────

export type AutomationActionType =
  | "create_task"
  | "send_notification"
  | "send_email"
  | "change_status"
  | "escalate"
  | "trigger_webhook";

export interface CreateTaskActionConfig {
  title: string;
  assigneeRole: string;
  deadlineDays: number;
  description?: string;
}

export interface SendNotificationActionConfig {
  role: string;
  message: string;
}

export interface SendEmailActionConfig {
  templateKey: string;
  recipientRole: string;
}

export interface ChangeStatusActionConfig {
  newStatus: string;
}

export interface EscalateActionConfig {
  targetRole: string;
  message: string;
}

export interface TriggerWebhookActionConfig {
  webhookId: string;
}

export type AutomationActionConfig =
  | CreateTaskActionConfig
  | SendNotificationActionConfig
  | SendEmailActionConfig
  | ChangeStatusActionConfig
  | EscalateActionConfig
  | TriggerWebhookActionConfig;

export interface AutomationAction {
  type: AutomationActionType;
  config: AutomationActionConfig;
}

// ─── Execution Types ────────────────────────────────────────

export type AutomationExecutionStatus =
  | "success"
  | "partial_failure"
  | "failure"
  | "skipped_cooldown"
  | "skipped_ratelimit"
  | "dry_run";

export interface ActionExecutionResult {
  type: AutomationActionType;
  status: "success" | "failure";
  result?: Record<string, unknown>;
  error?: string;
}

// ─── Rule Entity ────────────────────────────────────────────

export interface AutomationRule {
  id: string;
  orgId: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  triggerType: AutomationTriggerType;
  triggerConfig: AutomationTriggerConfig;
  conditions: ConditionGroup;
  actions: AutomationAction[];
  cooldownMinutes: number;
  maxExecutionsPerHour: number;
  executionCount: number;
  lastExecutedAt?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationRuleExecution {
  id: string;
  ruleId: string;
  orgId: string;
  triggeredByEventId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  conditionsMatched: boolean;
  actionsExecuted: ActionExecutionResult[];
  status: AutomationExecutionStatus;
  durationMs?: number | null;
  errorMessage?: string | null;
  executedAt: string;
}

export interface AutomationRuleTemplate {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  triggerType: AutomationTriggerType;
  triggerConfig: AutomationTriggerConfig;
  conditions: ConditionGroup;
  actions: AutomationAction[];
  isBuiltIn: boolean;
  orgId?: string | null;
  createdAt: string;
}

// ─── Template Categories ────────────────────────────────────

export type AutomationTemplateCategory =
  | "risk_management"
  | "control_testing"
  | "vendor_management"
  | "audit"
  | "data_protection"
  | "compliance"
  | "isms"
  | "esg";

// ─── Dashboard Stats ────────────────────────────────────────

export interface AutomationDashboardStats {
  activeRules: number;
  totalRules: number;
  executions24h: number;
  successRate24h: number;
  errorRate24h: number;
  topRules: Array<{
    ruleId: string;
    ruleName: string;
    executionCount: number;
    errorCount: number;
  }>;
}

// ─── Entity fields available for conditions ─────────────────

export interface EntityFieldOption {
  field: string;
  label: string;
  type: "string" | "number" | "boolean" | "date";
}

export type EntityFieldMap = Record<string, EntityFieldOption[]>;
