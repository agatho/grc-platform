import {
  db,
  policyDistribution,
  policyAcknowledgment,
  notification,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql } from "drizzle-orm";
import { withAuth, withAuditContext, paginate, paginatedResponse } from "@/lib/api";
import { z } from "zod";

// GET /api/v1/policies/distributions/:id/overdue — Overdue users list
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "dpo");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const { page, limit, offset } = paginate(req);

  // Verify distribution belongs to org
  const [dist] = await db
    .select()
    .from(policyDistribution)
    .where(
      and(
        eq(policyDistribution.id, id),
        eq(policyDistribution.orgId, ctx.orgId),
      ),
    );

  if (!dist) {
    return Response.json({ error: "Distribution not found" }, { status: 404 });
  }

  const rows = await db.execute(sql`
    SELECT
      pa.id,
      pa.user_id as "userId",
      pa.status,
      pa.reminders_sent as "remindersSent",
      pa.created_at as "createdAt",
      u.name as "userName",
      u.email as "userEmail",
      u.department,
      EXTRACT(DAY FROM (NOW() - ${dist.deadline}::timestamptz))::int as "overdueDays"
    FROM policy_acknowledgment pa
    INNER JOIN "user" u ON u.id = pa.user_id
    WHERE pa.distribution_id = ${id}
      AND pa.org_id = ${ctx.orgId}
      AND pa.status IN ('pending', 'overdue')
    ORDER BY pa.created_at ASC
    LIMIT ${limit} OFFSET ${offset}
  `);

  const countResult = await db.execute(sql`
    SELECT COUNT(*)::int as total
    FROM policy_acknowledgment
    WHERE distribution_id = ${id}
      AND org_id = ${ctx.orgId}
      AND status IN ('pending', 'overdue')
  `);
  const total = (countResult[0] as { total: number }).total;

  return paginatedResponse(rows as unknown as Record<string, unknown>[], total, page, limit);
}

// POST /api/v1/policies/distributions/:id/overdue — Send reminders to overdue users
const sendReminderSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1).max(100),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "dpo");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const body = sendReminderSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const [dist] = await db
    .select()
    .from(policyDistribution)
    .where(
      and(
        eq(policyDistribution.id, id),
        eq(policyDistribution.orgId, ctx.orgId),
      ),
    );

  if (!dist) {
    return Response.json({ error: "Distribution not found" }, { status: 404 });
  }

  const now = new Date();
  let remindersSent = 0;

  await withAuditContext(ctx, async (tx) => {
    for (const userId of body.data.userIds) {
      // Create notification
      await tx.insert(notification).values({
        userId,
        orgId: ctx.orgId,
        type: "deadline_approaching",
        entityType: "policy_distribution",
        entityId: id,
        title: `Reminder: Policy acknowledgment overdue — ${dist.title}`,
        message: `Your acknowledgment for "${dist.title}" is overdue. Please acknowledge immediately.`,
        channel: "both",
        templateKey: "policy_reminder",
        templateData: {
          policyTitle: dist.title,
          deadline: dist.deadline,
          distributionId: id,
        },
        createdAt: now,
        updatedAt: now,
      });

      // Increment reminders_sent
      await tx
        .update(policyAcknowledgment)
        .set({
          remindersSent: sql`${policyAcknowledgment.remindersSent} + 1`,
          updatedAt: now,
        })
        .where(
          and(
            eq(policyAcknowledgment.distributionId, id),
            eq(policyAcknowledgment.userId, userId),
          ),
        );

      remindersSent++;
    }
  });

  return Response.json({ data: { remindersSent } });
}
