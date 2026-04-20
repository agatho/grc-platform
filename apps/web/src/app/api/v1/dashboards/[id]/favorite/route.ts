import { db, customDashboard } from "@grc/db";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// PUT /api/v1/dashboards/:id/favorite — Toggle favorite
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  const dashboard = await db.query.customDashboard.findFirst({
    where: and(
      eq(customDashboard.id, id),
      eq(customDashboard.orgId, ctx.orgId),
      isNull(customDashboard.deletedAt),
    ),
  });

  if (!dashboard) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Check visibility
  if (dashboard.visibility === "personal" && dashboard.userId !== ctx.userId) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx
      .update(customDashboard)
      .set({
        isFavorite: !dashboard.isFavorite,
        updatedAt: new Date(),
      })
      .where(eq(customDashboard.id, id))
      .returning();

    return updated;
  });

  return Response.json({ data: result });
}
