import { db, pushNotification } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// POST /api/v1/mobile/push/:id/read — Mark push notification as read
export async function POST(
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
}
