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
import { checkResolvedHostIsPublic } from "@grc/shared/lib/url-safety-server";
import { and, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { resolveOrgRecipients } from "../lib/recipients";
import { insertNotification } from "../lib/notify";

// #S10-16 (ARCTOS-FULL-2026-08-31, Medium): tables the `change_status`
// automation action may write to.
//
// `params.entityType` originates in an automation rule that an org user
// authors in the UI. It was passed straight into `sql.identifier()`. That
// is not SQL injection — the identifier is quoted correctly and the
// `org_id` filter keeps the tenant boundary — but it let a rule set
// `status` on ANY table carrying (id, org_id, status, updated_at),
// including tables the rule's author has no route permission for.
//
// Documented escalation: a user with automation-edit rights but no DMS
// rights writes `changeStatus(entityType: "document", newStatus:
// "expired")`. `document-retention-purge.ts` selects
// `status IN ('archived','expired')` and hard-deletes — turning an
// automation rule into a deletion tool for documents the author could not
// otherwise touch.
//
// Adding a new automation-managed entity is now a deliberate, reviewable
// edit to this list. `document` is intentionally NOT on it.
const AUTOMATION_STATUS_TABLES = new Set([
  "risk",
  "control",
  "finding",
  "incident",
  "task",
  "work_item",
  "vendor",
  "asset",
]);

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
  // [WP9 · S10-07] This query used to ignore `deleted_at`. Revoking an org
  // role is a SOFT delete (`UPDATE user_organization_role SET deleted_at =
  // now()`), so a person who had left the organisation kept being resolved
  // as the recipient of automation tasks and escalations. Delegated to the
  // shared resolver so the filter is not maintained in nine places.
  const [userId] = await resolveOrgRecipients(orgId, [role, "admin"], {
    limit: 1,
    preferRole: role,
  });
  return userId ?? null;
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
    // [WP9 · S10-15] This was `console.log`. The automation engine's e-mail
    // action — one of five actions a rule author can pick in the UI — did
    // nothing at all, and reported success.
    //
    // It now writes a real notification on the `email` channel with the
    // rule's template key and data. `scheduled-notifications` picks it up
    // and delivers it, which is the same path every other e-mail in the
    // platform takes; an unknown template key is rejected at this point
    // (S10-03) rather than three failed deliveries later.
    try {
      const recipients = await resolveOrgRecipients(
        params.orgId,
        [params.recipientRole],
        { limit: 25 },
      );
      if (recipients.length === 0) {
        console.error(
          `[AutomationServices] sendEmail: no active member with role ${params.recipientRole} in org ${params.orgId}`,
        );
        return;
      }
      const title =
        typeof params.data.title === "string"
          ? params.data.title
          : `Automation: ${params.templateKey}`;
      for (const userId of recipients) {
        await insertNotification(
          {
            orgId: params.orgId,
            userId,
            type: "escalation",
            title,
            message:
              typeof params.data.message === "string"
                ? params.data.message
                : null,
            channel: "email",
            templateKey: params.templateKey,
            templateData: params.data,
            scheduledFor: new Date(),
          },
          { job: "automation-engine", dedupeWindow: "day" },
        );
      }
    } catch (err) {
      console.error("[AutomationServices] sendEmail failed:", err);
    }
  },

  changeStatus: async (params) => {
    // Generic status update via raw SQL (entity type varies).
    // #S10-16: refuse any entity that is not automation-managed. See the
    // AUTOMATION_STATUS_TABLES comment at the top of this file.
    if (!AUTOMATION_STATUS_TABLES.has(params.entityType)) {
      console.error(
        `[AutomationServices] changeStatus refused: '${params.entityType}' is not an automation-managed entity (org ${params.orgId}, entity ${params.entityId})`,
      );
      return;
    }
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

      // DNS-rebinding defense: even if the URL passed the literal-host
      // check, the hostname could still resolve to a private IP (DNS
      // rebinding, /etc/hosts override, CNAME chain to internal IP).
      // Resolve and verify before issuing fetch.
      const hostCheck = await checkResolvedHostIsPublic(urlCheck.url.hostname);
      if (!hostCheck.ok) {
        console.error(
          `[AutomationServices] triggerWebhook: DNS rebind guard rejected ${webhook.id}: ${hostCheck.reason}`,
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
          errorMessage: `DNS rebind guard rejected: ${hostCheck.reason}`,
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
            "X-Arctos-Timestamp": new Date().toISOString(),
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
