import { db } from "@grc/db";
import { sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// DELETE /api/v1/notifications/scheduled/:id — Cancel a scheduled notification (admin only)
// Only cancellable if email_sent_at IS NULL (not yet sent). Performs soft delete.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  // Check the notification exists, belongs to this org, is scheduled, and not yet sent
  const existing = await db.execute(sql`
    SELECT id, email_sent_at, scheduled_for
    FROM notification
    WHERE id = ${id}
      AND org_id = ${ctx.orgId}
      AND deleted_at IS NULL
  `);

  if (!existing[0]) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const record = existing[0] as Record<string, unknown>;

  if (!record.scheduled_for) {
    return Response.json(
      { error: "This notification is not a scheduled notification" },
      { status: 422 },
    );
  }

  if (record.email_sent_at) {
    return Response.json(
      { error: "Cannot cancel a notification that has already been sent" },
      { status: 422 },
    );
  }

  const deleted = await withAuditContext(ctx, async (tx) => {
    const rows = await tx.execute(sql`
      UPDATE notification
      SET deleted_at = now(),
          deleted_by = ${ctx.userId},
          updated_by = ${ctx.userId}
      WHERE id = ${id}
        AND org_id = ${ctx.orgId}
        AND email_sent_at IS NULL
        AND deleted_at IS NULL
      RETURNING id
    `);
    return rows[0];
  });

  if (!deleted) {
    return Response.json(
      { error: "Not found or already sent" },
      { status: 404 },
    );
  }

  return Response.json({ data: { id, cancelled: true } });
}
