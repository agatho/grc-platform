import { db } from "@grc/db";
import { createScheduledNotificationSchema } from "@grc/shared";
import { sql } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";

// POST /api/v1/notifications/scheduled — Create scheduled notification (admin only)
export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const body = createScheduledNotificationSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const {
    recipientRole,
    recipientUserIds,
    subject,
    message,
    scheduledFor,
    templateKey,
  } = body.data;

  // Must specify at least one of recipientRole or recipientUserIds
  if (!recipientRole && (!recipientUserIds || recipientUserIds.length === 0)) {
    return Response.json(
      { error: "Must specify either recipientRole or recipientUserIds" },
      { status: 422 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    let userIds: string[] = [];

    if (recipientRole) {
      // Find all users with the specified role in the current org
      const roleUsers = (await tx.execute(sql`
        SELECT uor.user_id
        FROM user_organization_role uor
        JOIN "user" u ON u.id = uor.user_id AND u.deleted_at IS NULL AND u.is_active = true
        WHERE uor.org_id = ${ctx.orgId}
          AND uor.role = ${recipientRole}::user_role
          AND uor.deleted_at IS NULL
      `)) as { user_id: string }[];
      userIds = roleUsers.map((r) => r.user_id);
    }

    if (recipientUserIds && recipientUserIds.length > 0) {
      // Merge with any role-based user IDs (deduplicate)
      const set = new Set([...userIds, ...recipientUserIds]);
      userIds = [...set];
    }

    if (userIds.length === 0) {
      return { created: 0 };
    }

    // Insert a notification for each recipient
    const values = userIds.map(
      (userId) => sql`(
        ${userId},
        ${ctx.orgId},
        'task_assigned',
        ${subject},
        ${message},
        'both',
        ${templateKey ?? null},
        ${scheduledFor},
        ${ctx.userId}
      )`,
    );

    await tx.execute(sql`
      INSERT INTO notification (
        user_id, org_id, type, title, message,
        channel, template_key, scheduled_for, created_by
      )
      VALUES ${sql.join(values, sql`, `)}
    `);

    return { created: userIds.length, recipientUserIds: userIds };
  });

  return Response.json({ data: result }, { status: 201 });
}

// GET /api/v1/notifications/scheduled — List scheduled notifications for current org (admin only)
export async function GET(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { page, limit, offset, searchParams } = paginate(req);
  const statusFilter = searchParams.get("status"); // 'pending' or 'sent'

  let statusCondition = sql``;
  if (statusFilter === "pending") {
    statusCondition = sql`AND n.email_sent_at IS NULL AND n.scheduled_for IS NOT NULL`;
  } else if (statusFilter === "sent") {
    statusCondition = sql`AND n.email_sent_at IS NOT NULL`;
  }

  const [items, countResult] = await Promise.all([
    db.execute(sql`
      SELECT n.*, u.name AS recipient_name, u.email AS recipient_email
      FROM notification n
      JOIN "user" u ON u.id = n.user_id
      WHERE n.org_id = ${ctx.orgId}
        AND n.scheduled_for IS NOT NULL
        AND n.deleted_at IS NULL
        ${statusCondition}
      ORDER BY n.scheduled_for DESC
      LIMIT ${limit} OFFSET ${offset}
    `),
    db.execute<{ total: number }>(sql`
      SELECT count(*)::int AS total
      FROM notification n
      WHERE n.org_id = ${ctx.orgId}
        AND n.scheduled_for IS NOT NULL
        AND n.deleted_at IS NULL
        ${statusCondition}
    `),
  ]);

  return paginatedResponse(items, countResult[0].total, page, limit);
}
