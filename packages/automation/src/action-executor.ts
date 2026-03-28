// Sprint 28: Action Executor — executes 6 GRC-internal action types
// All actions remain WITHIN the GRC system. No external system changes.

import type {
  AutomationAction,
  ActionExecutionResult,
  CreateTaskActionConfig,
  SendNotificationActionConfig,
  SendEmailActionConfig,
  ChangeStatusActionConfig,
  EscalateActionConfig,
  TriggerWebhookActionConfig,
} from "@grc/shared";
import { interpolateConfig } from "./template-interpolator";

export interface ActionContext {
  orgId: string;
  entityType: string;
  entityId: string;
  entity: Record<string, unknown>;
  userId?: string;
}

export interface ActionServices {
  createTask: (params: {
    orgId: string;
    title: string;
    assigneeRole: string;
    deadlineDays: number;
    description?: string;
    sourceEntityType: string;
    sourceEntityId: string;
  }) => Promise<{ id: string }>;

  sendNotification: (params: {
    orgId: string;
    role: string;
    message: string;
    link?: string;
  }) => Promise<void>;

  sendEmail: (params: {
    orgId: string;
    templateKey: string;
    recipientRole: string;
    data: Record<string, unknown>;
  }) => Promise<void>;

  changeStatus: (params: {
    entityType: string;
    entityId: string;
    newStatus: string;
    orgId: string;
  }) => Promise<void>;

  escalate: (params: {
    orgId: string;
    targetRole: string;
    message: string;
    entityType: string;
    entityId: string;
  }) => Promise<void>;

  triggerWebhook: (params: {
    webhookId: string;
    event: Record<string, unknown>;
  }) => Promise<void>;
}

/**
 * Execute a single action with the given context and services.
 */
async function executeSingleAction(
  action: AutomationAction,
  context: ActionContext,
  services: ActionServices,
): Promise<ActionExecutionResult> {
  try {
    const interpolatedConfig = interpolateConfig(
      action.config as unknown as Record<string, unknown>,
      context.entity,
    );

    switch (action.type) {
      case "create_task": {
        const config = interpolatedConfig as unknown as CreateTaskActionConfig;
        const result = await services.createTask({
          orgId: context.orgId,
          title: config.title,
          assigneeRole: config.assigneeRole,
          deadlineDays: config.deadlineDays,
          description: config.description,
          sourceEntityType: context.entityType,
          sourceEntityId: context.entityId,
        });
        return {
          type: "create_task",
          status: "success",
          result: { taskId: result.id, taskTitle: config.title },
        };
      }

      case "send_notification": {
        const config =
          interpolatedConfig as unknown as SendNotificationActionConfig;
        await services.sendNotification({
          orgId: context.orgId,
          role: config.role,
          message: config.message,
        });
        return { type: "send_notification", status: "success" };
      }

      case "send_email": {
        const config = interpolatedConfig as unknown as SendEmailActionConfig;
        await services.sendEmail({
          orgId: context.orgId,
          templateKey: config.templateKey,
          recipientRole: config.recipientRole,
          data: context.entity,
        });
        return { type: "send_email", status: "success" };
      }

      case "change_status": {
        const config =
          interpolatedConfig as unknown as ChangeStatusActionConfig;
        await services.changeStatus({
          entityType: context.entityType,
          entityId: context.entityId,
          newStatus: config.newStatus,
          orgId: context.orgId,
        });
        return {
          type: "change_status",
          status: "success",
          result: { newStatus: config.newStatus },
        };
      }

      case "escalate": {
        const config = interpolatedConfig as unknown as EscalateActionConfig;
        await services.escalate({
          orgId: context.orgId,
          targetRole: config.targetRole,
          message: config.message,
          entityType: context.entityType,
          entityId: context.entityId,
        });
        return { type: "escalate", status: "success" };
      }

      case "trigger_webhook": {
        const config =
          interpolatedConfig as unknown as TriggerWebhookActionConfig;
        await services.triggerWebhook({
          webhookId: config.webhookId,
          event: {
            entityType: context.entityType,
            entityId: context.entityId,
            entity: context.entity,
          },
        });
        return { type: "trigger_webhook", status: "success" };
      }

      default:
        return {
          type: action.type,
          status: "failure",
          error: `Unknown action type: ${action.type}`,
        };
    }
  } catch (err) {
    return {
      type: action.type,
      status: "failure",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Execute all actions for a rule, returning results for each.
 * Actions are executed sequentially (one failure should not block others).
 */
export async function executeActions(
  actions: AutomationAction[],
  context: ActionContext,
  services: ActionServices,
): Promise<ActionExecutionResult[]> {
  const results: ActionExecutionResult[] = [];

  for (const action of actions) {
    const result = await executeSingleAction(action, context, services);
    results.push(result);
  }

  return results;
}

/**
 * Determine the overall status based on individual action results.
 */
export function determineExecutionStatus(
  results: ActionExecutionResult[],
): "success" | "partial_failure" | "failure" {
  const allSuccess = results.every((r) => r.status === "success");
  const allFailure = results.every((r) => r.status === "failure");

  if (allSuccess) return "success";
  if (allFailure) return "failure";
  return "partial_failure";
}
