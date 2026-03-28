import { db, webhookDeliveryLog, webhookRegistration } from "@grc/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";

// GET /api/v1/webhooks/:id/deliveries — Delivery log for a webhook
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  // Verify webhook belongs to this org
  const [webhook] = await db
    .select({ id: webhookRegistration.id })
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

  const { page, limit, offset, searchParams } = paginate(req);

  const conditions = [eq(webhookDeliveryLog.webhookId, id)];

  const statusFilter = searchParams.get("status");
  if (statusFilter) {
    conditions.push(eq(webhookDeliveryLog.status, statusFilter));
  }

  const rows = await db
    .select()
    .from(webhookDeliveryLog)
    .where(and(...conditions))
    .orderBy(desc(webhookDeliveryLog.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ count: total }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(webhookDeliveryLog)
    .where(and(...conditions));

  return paginatedResponse(rows, total, page, limit);
}
