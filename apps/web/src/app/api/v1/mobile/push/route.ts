import { db, pushNotification, deviceRegistration } from "@grc/db";
import { sendPushNotificationSchema, bulkSendPushSchema } from "@grc/shared";
import { eq, and, desc, sql } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";

// POST /api/v1/mobile/push — Send push notification
export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const body = sendPushNotificationSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Get active devices for user
  const devices = await db
    .select()
    .from(deviceRegistration)
    .where(
      and(
        eq(deviceRegistration.orgId, ctx.orgId),
        eq(deviceRegistration.userId, body.data.userId),
        eq(deviceRegistration.isActive, true),
      ),
    );

  const notifications = [];
  for (const device of devices) {
    const [notif] = await db
      .insert(pushNotification)
      .values({
        orgId: ctx.orgId,
        userId: body.data.userId,
        deviceId: device.id,
        title: body.data.title,
        body: body.data.body,
        data: body.data.data,
        category: body.data.category,
        priority: body.data.priority,
        status: "queued",
      })
      .returning();
    notifications.push(notif);
  }

  return Response.json({ data: notifications }, { status: 201 });
}

// GET /api/v1/mobile/push — List push notifications for current user
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { page, limit, offset } = paginate(req);

  const rows = await db
    .select()
    .from(pushNotification)
    .where(
      and(
        eq(pushNotification.orgId, ctx.orgId),
        eq(pushNotification.userId, ctx.userId),
      ),
    )
    .orderBy(desc(pushNotification.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(pushNotification)
    .where(
      and(
        eq(pushNotification.orgId, ctx.orgId),
        eq(pushNotification.userId, ctx.userId),
      ),
    );

  return Response.json(paginatedResponse(rows, Number(count), page, limit));
}
