import { db } from "@grc/db";
import { updateNotificationPreferencesSchema } from "@grc/shared";
import { sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/users/me/notification-preferences — Return current notification preferences
export const GET = withErrorHandler(async function GET() {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const rows = await db.execute(sql`
    SELECT notification_preferences
    FROM "user"
    WHERE id = ${ctx.userId} AND deleted_at IS NULL
  `);

  if (!rows[0]) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  const prefs =
    (rows[0] as Record<string, unknown>).notification_preferences ?? {};
  return Response.json({ data: prefs });
});
// PUT /api/v1/users/me/notification-preferences — Update notification preferences
export const PUT = withErrorHandler(async function PUT(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const body = updateNotificationPreferencesSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const { emailMode, digestTime, quietHoursStart, quietHoursEnd } = body.data;

  const preferences = {
    emailMode,
    ...(digestTime !== undefined && { digestTime }),
    ...(quietHoursStart !== undefined && { quietHoursStart }),
    ...(quietHoursEnd !== undefined && { quietHoursEnd }),
  };

  const updated = await withAuditContext(ctx, async (tx) => {
    const rows = await tx.execute(sql`
      UPDATE "user"
      SET notification_preferences = ${JSON.stringify(preferences)}::jsonb,
          updated_by = ${ctx.userId}
      WHERE id = ${ctx.userId} AND deleted_at IS NULL
      RETURNING id, notification_preferences
    `);
    return rows[0];
  });

  if (!updated) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  return Response.json({
    data: (updated as Record<string, unknown>).notification_preferences,
  });
});
