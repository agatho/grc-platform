import { db, webhookRegistration } from "@grc/db";
import { updateWebhookSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/webhooks/:id — Get single webhook (admin only)
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  const [webhook] = await db
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
    .where(
      and(
        eq(webhookRegistration.id, id),
        eq(webhookRegistration.orgId, ctx.orgId),
      ),
    );

  if (!webhook) {
    return Response.json({ error: "Webhook not found" }, { status: 404 });
  }

  return Response.json({ data: webhook });
}

// PUT /api/v1/webhooks/:id — Update webhook (admin only)
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  const body = updateWebhookSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const [existing] = await db
    .select({ id: webhookRegistration.id })
    .from(webhookRegistration)
    .where(
      and(
        eq(webhookRegistration.id, id),
        eq(webhookRegistration.orgId, ctx.orgId),
      ),
    );

  if (!existing) {
    return Response.json({ error: "Webhook not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (body.data.name !== undefined) updateData.name = body.data.name;
  if (body.data.url !== undefined) updateData.url = body.data.url;
  if (body.data.eventFilter !== undefined) updateData.eventFilter = body.data.eventFilter;
  if (body.data.headers !== undefined) updateData.headers = body.data.headers;
  if (body.data.isActive !== undefined) updateData.isActive = body.data.isActive;
  if (body.data.templateType !== undefined) updateData.templateType = body.data.templateType;

  const [updated] = await db
    .update(webhookRegistration)
    .set(updateData)
    .where(
      and(
        eq(webhookRegistration.id, id),
        eq(webhookRegistration.orgId, ctx.orgId),
      ),
    )
    .returning({
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
    });

  return Response.json({ data: updated });
}

// DELETE /api/v1/webhooks/:id — Delete webhook (admin only)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  const [deleted] = await db
    .delete(webhookRegistration)
    .where(
      and(
        eq(webhookRegistration.id, id),
        eq(webhookRegistration.orgId, ctx.orgId),
      ),
    )
    .returning({ id: webhookRegistration.id });

  if (!deleted) {
    return Response.json({ error: "Webhook not found" }, { status: 404 });
  }

  return Response.json({ data: { id: deleted.id, deleted: true } });
}
