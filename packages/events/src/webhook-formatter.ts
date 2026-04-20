// Sprint 22: Webhook payload formatters for Slack, Teams, and generic JSON

import type { GrcEvent } from "./event-bus";

interface FormattedPayload {
  headers: Record<string, string>;
  body: string;
}

/**
 * Format a GRC event as a generic JSON webhook payload.
 */
export function formatGenericPayload(event: GrcEvent): FormattedPayload {
  return {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event: event.eventType,
      entityType: event.entityType,
      entityId: event.entityId,
      orgId: event.orgId,
      userId: event.userId,
      payload: event.payload,
      timestamp: event.emittedAt.toISOString(),
    }),
  };
}

/**
 * Format a GRC event as a Slack webhook payload (Incoming Webhook format).
 */
export function formatSlackPayload(event: GrcEvent): FormattedPayload {
  const entityLabel = event.entityType.replace(/_/g, " ");
  const eventLabel = event.eventType.replace("entity.", "");
  const entityId = event.entityId.slice(0, 8);

  let text = `*[${entityLabel.toUpperCase()}]* ${entityId}... was ${eventLabel}`;

  // Add status change details
  if (
    event.eventType === "entity.status_changed" &&
    event.payload.after?.status
  ) {
    text += ` to \`${event.payload.after.status}\``;
  }

  // Add title if available
  const title = event.payload.after?.title || event.payload.before?.title;
  if (title) {
    text += `\n>${title}`;
  }

  return {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  };
}

/**
 * Format a GRC event as a Microsoft Teams Adaptive Card payload.
 */
export function formatTeamsPayload(event: GrcEvent): FormattedPayload {
  const entityLabel = event.entityType.replace(/_/g, " ");
  const eventLabel = event.eventType.replace("entity.", "");
  const entityId = event.entityId.slice(0, 8);

  const title =
    (event.payload.after?.title as string) ||
    (event.payload.before?.title as string) ||
    `${entityLabel} ${entityId}...`;

  const summary = `${entityLabel} ${eventLabel}: ${title}`;

  const facts: Array<{ name: string; value: string }> = [
    { name: "Entity Type", value: entityLabel },
    { name: "Event", value: eventLabel },
    { name: "Entity ID", value: event.entityId },
  ];

  if (
    event.eventType === "entity.status_changed" &&
    event.payload.before?.status &&
    event.payload.after?.status
  ) {
    facts.push({
      name: "Status Change",
      value: `${event.payload.before.status} → ${event.payload.after.status}`,
    });
  }

  if (event.payload.changedFields?.length) {
    facts.push({
      name: "Changed Fields",
      value: event.payload.changedFields.join(", "),
    });
  }

  const card = {
    type: "MessageCard",
    "@context": "https://schema.org/extensions",
    summary,
    themeColor: getThemeColor(event.eventType),
    sections: [
      {
        activityTitle: summary,
        facts,
        markdown: true,
      },
    ],
  };

  return {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(card),
  };
}

function getThemeColor(eventType: string): string {
  switch (eventType) {
    case "entity.created":
      return "00CC00";
    case "entity.updated":
      return "0078D4";
    case "entity.deleted":
      return "CC0000";
    case "entity.status_changed":
      return "FF8C00";
    default:
      return "808080";
  }
}

/**
 * Select the appropriate formatter based on template type.
 */
export function formatWebhookPayload(
  templateType: string | null | undefined,
  event: GrcEvent,
): FormattedPayload {
  switch (templateType) {
    case "slack":
      return formatSlackPayload(event);
    case "teams":
      return formatTeamsPayload(event);
    default:
      return formatGenericPayload(event);
  }
}
