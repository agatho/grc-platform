import { db, webhookRegistration } from "@grc/db";
import { formatWebhookPayload, signPayload } from "@grc/events";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import type { GrcEvent } from "@grc/events";

// POST /api/v1/webhooks/:id/test — Send a test event to the webhook
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  const [webhook] = await db
    .select()
    .from(webhookRegistration)
    .where(
      and(
        eq(webhookRegistration.id, id),
        eq(webhookRegistration.orgId, ctx.orgId),
      ),
    );

  if (!webhook) {
    return Response.json({ error: "Webhook not found" }, { status: 404 });
  }

  // Create a test event
  const testEvent: GrcEvent = {
    orgId: ctx.orgId,
    eventType: "entity.created",
    entityType: "test",
    entityId: "00000000-0000-0000-0000-000000000000",
    userId: ctx.userId,
    payload: {
      after: {
        title: "Test event from ARCTOS",
        description:
          "This is a test webhook delivery. If you see this, your webhook is configured correctly.",
      },
    },
    emittedAt: new Date(),
  };

  const formatted = formatWebhookPayload(webhook.templateType, testEvent);
  const signature = signPayload(formatted.body, webhook.secretHash);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        ...formatted.headers,
        ...((webhook.headers as Record<string, string>) ?? {}),
        "X-Arctos-Signature": signature,
        "X-Arctos-Event": "test",
        "User-Agent": "ARCTOS-Webhook/1.0",
      },
      body: formatted.body,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const responseBody = await response.text().catch(() => "");

    return Response.json({
      data: {
        success: response.ok,
        statusCode: response.status,
        responseBody: responseBody.slice(0, 1000),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({
      data: {
        success: false,
        statusCode: null,
        error: message,
      },
    });
  }
}
