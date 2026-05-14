// POST /api/v1/notifications/mark-all-read
//
// #WAVE15-P2-07: Wave-14 QA flagged the missing endpoint — every
// notification inbox UI in the world has a single "mark all" button,
// and operators routinely have hundreds of unread items in long-lived
// orgs. The previous workaround (loop the single PUT /:id/read) is
// O(n) round-trips and burns the rate limit budget.
//
// Scope: every unread notification belonging to the calling user in
// the active org (org_id + user_id, deleted_at IS NULL, is_read = false).
// Returns the count of rows actually flipped — clients use this to
// drive the "X notifications marked as read" toast.

import { db } from "@grc/db";
import { sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";

export const POST = withErrorHandler(async function POST(_req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const result = await withAuditContext(ctx, async (tx) => {
    const rows = await tx.execute<{ id: string }>(sql`
      UPDATE notification
      SET is_read = true, updated_by = ${ctx.userId}
      WHERE user_id = ${ctx.userId}
        AND org_id = ${ctx.orgId}
        AND is_read = false
        AND deleted_at IS NULL
      RETURNING id
    `);
    return rows;
  });

  return Response.json({
    data: {
      markedAsRead: result.length,
    },
  });
});
