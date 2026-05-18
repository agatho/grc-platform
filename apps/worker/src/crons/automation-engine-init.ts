// Sprint 28: Automation Engine initialization
// Subscribes the AutomationEngine to the Event Bus (Sprint 22)
// Provides GRC-internal action services (task, notification, email, etc.)

import {
  eventBus,
  formatWebhookPayload,
  signPayload,
  type GrcEvent,
} from "@grc/events";
import { AutomationEngine } from "@grc/automation";
import type { ActionServices } from "@grc/automation";
import {
  db,
  notification,
  task,
  webhookRegistration,
  webhookDeliveryLog,
} from "@grc/db";
import { checkWebhookUrl } from "@grc/shared";
import { and, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";

/**
 * Resolve a user in the given org that holds one of the requested roles.
 * Used to pick a createdBy/recipient for system-triggered automation actions,
 * since the automation engine passes roles (not user IDs) but the task and
 * notification tables require concrete user UUIDs.
 */
async function resolveOrgUserForRole(
  orgId: string,
  role: string,
): Promise<string | null> {
  const rows = await db.execute(sql`
    SELECT user_id FROM user_organization_role
    WHERE org_id = ${orgId}::uuid
      AND role IN (${role}, 'admin')
    ORDER BY CASE WHEN role = ${role} THEN 0 ELSE 1 END
    LIMIT 1
  `);
  return (rows as unknown as Array<{ user_id: string }>)[0]?.user_id ?? null;
}

/**
 * Stub action services that integrate with existing platform services.
 * In production, these connect to the real task/notification/email services.
 */
const automationActionServices: ActionServices = {
  createTask: async (params) => {
    // Create task via direct DB insert (uses Sprint 1.2 task table)
    try {
      const createdBy = await resolveOrgUserForRole(
        params.orgId,
        params.assigneeRole,
      );
      if (!createdBy) {
        console.error(
          `[AutomationServices] createTask: no user with role ${params.assigneeRole} or admin in org ${params.orgId}`,
        );
        return { id: "failed" };
      }
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
          assigneeRole: params.assigneeRole,
          assigneeId: createdBy,
          createdBy,
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
      const userId = await resolveOrgUserForRole(params.orgId, params.role);
      if (!userId) return;
      await db.insert(notification).values({
        orgId: params.orgId,
        userId,
        type: "escalation",
        title: "Automation Notification",
        message: params.message,
        channel: "in_app",
        templateData: params.link ? { link: params.link } : {},
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
      const userId = await resolveOrgUserForRole(
        params.orgId,
        params.targetRole,
      );
      if (!userId) return;
      await db.insert(notification).values({
        orgId: params.orgId,
        userId,
        type: "escalation",
        title: `Escalation: ${params.entityType}`,
        message: params.message,
        entityType: params.entityType,
        entityId: params.entityId,
        channel: "both",
      });
    } catch (err) {
      console.error("[AutomationServices] escalate failed:", err);
    }
  },

  triggerWebhook: async (params) => {
    // F#6 (overnight 2026-05-18): replace the console.log stub with a real
    // HTTP delivery. Reads the registered webhook, formats the payload per
    // its template type, signs with HMAC-SHA256, re-checks the URL for
    // SSRF safety, fires POST with a 10s timeout, and records the result
    // in webhook_delivery_log. Failures are logged but do not throw —
    // the automation engine treats this action as best-effort.
    try {
      const [webhook] = await db
        .select()
        .from(webhookRegistration)
        .where(
          and(
            eq(webhookRegistration.id, params.webhookId),
            eq(webhookRegistration.isActive, true),
          ),
        );

      if (!webhook) {
        console.warn(
          `[AutomationServices] triggerWebhook: webhook ${params.webhookId} not found or inactive`,
        );
        return;
      }

      // Defence-in-depth SSRF check. Registration-time validation already
      // ran (PR #200), but rows that predate it could still be delivered.
      const urlCheck = checkWebhookUrl(webhook.url);
      if (!urlCheck.ok) {
        console.error(
          `[AutomationServices] triggerWebhook: refusing unsafe URL for webhook ${webhook.id}: ${urlCheck.reason}`,
        );
        await db.insert(webhookDeliveryLog).values({
          webhookId: webhook.id,
          eventType: "automation.trigger",
          entityType: String(params.event.entityType ?? "unknown"),
          entityId: String(
            params.event.entityId ?? "00000000-0000-0000-0000-000000000000",
          ),
          payload: params.event as Record<string, unknown>,
          status: "failed",
          errorMessage: `SSRF guard rejected URL: ${urlCheck.reason}`,
        });
        return;
      }

      const grcEvent: GrcEvent = {
        orgId: webhook.orgId,
        eventType: "entity.updated",
        entityType: String(params.event.entityType ?? "unknown"),
        entityId: String(
          params.event.entityId ?? "00000000-0000-0000-0000-000000000000",
        ),
        payload: { after: params.event },
        emittedAt: new Date(),
      };

      const formatted = formatWebhookPayload(webhook.templateType, grcEvent);
      const signature = signPayload(formatted.body, webhook.secretHash);

      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), 10_000);

      let responseStatus: number | null = null;
      let responseBody: string | null = null;
      let errorMessage: string | null = null;
      let deliveryStatus: "delivered" | "failed" = "failed";

      try {
        const response = await fetch(webhook.url, {
          method: "POST",
          headers: {
            ...formatted.headers,
            ...((webhook.headers as Record<string, string>) ?? {}),
            "X-Arctos-Signature": signature,
            "X-Arctos-Event": "automation.trigger",
            "User-Agent": "ARCTOS-Webhook/1.0",
          },
          body: formatted.body,
          signal: controller.signal,
        });

        responseStatus = response.status;
        responseBody = (await response.text().catch(() => "")).slice(0, 2000);
        deliveryStatus = response.ok ? "delivered" : "failed";
        if (!response.ok) {
          errorMessage = `HTTP ${response.status}`;
        }
      } catch (err) {
        errorMessage = err instanceof Error ? err.message : String(err);
        if (errorMessage.includes("aborted")) {
          errorMessage = "Webhook delivery timed out after 10s";
        }
      } finally {
        clearTimeout(timeoutHandle);
      }

      await db.insert(webhookDeliveryLog).values({
        webhookId: webhook.id,
        eventType: "automation.trigger",
        entityType: grcEvent.entityType,
        entityId: grcEvent.entityId,
        payload: grcEvent.payload as Record<string, unknown>,
        responseStatus,
        responseBody,
        deliveredAt: deliveryStatus === "delivered" ? new Date() : null,
        status: deliveryStatus,
        errorMessage,
      });
    } catch (err) {
      console.error("[AutomationServices] triggerWebhook failed:", err);
    }
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

  console.log(
    "[Sprint28] AutomationEngine initialized and subscribed to Event Bus",
  );

  return engineInstance;
}

/**
 * Get the singleton engine instance (for testing / health checks).
 */
export function getAutomationEngine(): AutomationEngine | null {
  return engineInstance;
}
