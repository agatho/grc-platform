import { db, webhookRegistration } from "@grc/db";
import { createWebhookSchema } from "@grc/shared";
import { generateWebhookSecret } from "@grc/events";
import { eq, and, desc } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";
import { sql } from "drizzle-orm";

// POST /api/v1/webhooks — Register a new webhook (admin only)
export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const body = createWebhookSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Generate secret — shown ONCE at creation, then only last 4 chars
  const { secret, hash, last4 } = generateWebhookSecret();

  const [created] = await db
    .insert(webhookRegistration)
    .values({
      orgId: ctx.orgId,
      name: body.data.name,
      url: body.data.url,
      secretHash: hash,
      secretLast4: last4,
      eventFilter: body.data.eventFilter,
      headers: body.data.headers ?? {},
      templateType: body.data.templateType ?? "generic",
      createdBy: ctx.userId,
    })
    .returning();

  // Return secret in plaintext ONCE
  return Response.json(
    {
      data: {
        ...created,
        secretHash: undefined,
        secret, // plaintext, shown only at creation
      },
    },
    { status: 201 },
  );
}

// GET /api/v1/webhooks — List webhook registrations (admin only)
export async function GET(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { page, limit, offset } = paginate(req);

  const rows = await db
    .select({
      id: webhookRegistration.id,
      orgId: webhookRegistration.orgId,
      name: webhookRegistration.name,
      url: webhookRegistration.url,
      secretLast4: webhookRegistration.secretLast4,
      eventFilter: webhookRegistration.eventFilter,
      headers: webhookRegistration.headers,
      isActive: webhookRegistration.isActive,
      templateType: webhookRegistration.templateType,
      createdBy: webhookRegistration.createdBy,
      createdAt: webhookRegistration.createdAt,
      updatedAt: webhookRegistration.updatedAt,
    })
    .from(webhookRegistration)
    .where(eq(webhookRegistration.orgId, ctx.orgId))
    .orderBy(desc(webhookRegistration.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ count: total }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(webhookRegistration)
    .where(eq(webhookRegistration.orgId, ctx.orgId));

  return paginatedResponse(rows, total, page, limit);
}
