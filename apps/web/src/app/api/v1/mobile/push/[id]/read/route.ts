import { db, pushNotification } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// POST /api/v1/mobile/push/:id/read — Mark push notification as read
export const POST = withErrorHandler(async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const { id } = await params;

  const [updated] = await db
    .update(pushNotification)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(pushNotification.id, id),
        eq(pushNotification.userId, ctx.userId),
        eq(pushNotification.orgId, ctx.orgId),
      ),
    )
    .returning();

  if (!updated) {
    return Response.json({ error: "Notification not found" }, { status: 404 });
  }

  return Response.json({ data: updated });
});
