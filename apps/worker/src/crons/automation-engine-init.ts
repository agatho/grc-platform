// Sprint 28: Automation Engine initialization
// Subscribes the AutomationEngine to the Event Bus (Sprint 22)
// Provides GRC-internal action services (task, notification, email, etc.)

import { eventBus } from "@grc/events";
import { AutomationEngine } from "@grc/automation";
import type { ActionServices } from "@grc/automation";
import { db, notification, task } from "@grc/db";
import { sql } from "drizzle-orm";

/**
 * Stub action services that integrate with existing platform services.
 * In production, these connect to the real task/notification/email services.
 */
const automationActionServices: ActionServices = {
  createTask: async (params) => {
    // Create task via direct DB insert (uses Sprint 1.2 task table)
    try {
      const [created] = await db
        .insert(task)
        .values({
          orgId: params.orgId,
          title: params.title,
          description: params.description ?? null,
          status: "open",
          priority: "medium",
          sourceEntityType: params.sourceEntityType,
          sourceEntityId: params.sourceEntityId,
          dueDate: new Date(
            Date.now() + params.deadlineDays * 24 * 60 * 60 * 1000,
          ),
        })
        .returning({ id: task.id });
      return { id: created.id };
    } catch (err) {
      console.error("[AutomationServices] createTask failed:", err);
      return { id: "failed" };
    }
  },

  sendNotification: async (params) => {
    try {
      await db.insert(notification).values({
        orgId: params.orgId,
        type: "escalation",
        title: "Automation Notification",
        message: params.message,
        channel: "in_app",
        link: params.link ?? null,
      });
    } catch (err) {
      console.error("[AutomationServices] sendNotification failed:", err);
    }
  },

  sendEmail: async (params) => {
    // Email sending via Resend SDK — placeholder for Sprint 28
    console.log(
      `[AutomationServices] sendEmail: template=${params.templateKey} role=${params.recipientRole}`,
    );
  },

  changeStatus: async (params) => {
    // Generic status update via raw SQL (entity type varies)
    try {
      await db.execute(
        sql`UPDATE ${sql.identifier(params.entityType)} SET status = ${params.newStatus}, updated_at = now() WHERE id = ${params.entityId}::uuid AND org_id = ${params.orgId}::uuid`,
      );
    } catch (err) {
      console.error("[AutomationServices] changeStatus failed:", err);
    }
  },

  escalate: async (params) => {
    // Escalation = high-priority notification to target role
    try {
      await db.insert(notification).values({
        orgId: params.orgId,
        type: "escalation",
        title: `Escalation: ${params.entityType}`,
        message: params.message,
        channel: "both",
      });
    } catch (err) {
      console.error("[AutomationServices] escalate failed:", err);
    }
  },

  triggerWebhook: async (params) => {
    console.log(
      `[AutomationServices] triggerWebhook: webhookId=${params.webhookId}`,
    );
  },
};

let engineInstance: AutomationEngine | null = null;

/**
 * Initialize the automation engine and subscribe to the event bus.
 * Call once during worker startup.
 */
export function initAutomationEngine(): AutomationEngine {
  if (engineInstance) return engineInstance;

  engineInstance = new AutomationEngine({
    services: automationActionServices,
  });

  // Subscribe to ALL events from Event Bus
  eventBus.onEvent("entity.created", (event) => {
    void engineInstance!.handleEvent(event);
  });
  eventBus.onEvent("entity.updated", (event) => {
    void engineInstance!.handleEvent(event);
  });
  eventBus.onEvent("entity.deleted", (event) => {
    void engineInstance!.handleEvent(event);
  });
  eventBus.onEvent("entity.status_changed", (event) => {
    void engineInstance!.handleEvent(event);
  });

  console.log("[Sprint28] AutomationEngine initialized and subscribed to Event Bus");

  return engineInstance;
}

/**
 * Get the singleton engine instance (for testing / health checks).
 */
export function getAutomationEngine(): AutomationEngine | null {
  return engineInstance;
}
