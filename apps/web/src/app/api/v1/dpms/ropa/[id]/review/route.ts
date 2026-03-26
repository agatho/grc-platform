import { db, ropaEntry } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/dpms/ropa/:id/review — Mark RoPA entry as reviewed
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "dpo");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dpms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [existing] = await db
    .select()
    .from(ropaEntry)
    .where(
      and(
        eq(ropaEntry.id, id),
        eq(ropaEntry.orgId, ctx.orgId),
        isNull(ropaEntry.deletedAt),
      ),
    );

  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const now = new Date();
  // Set next review 12 months from now
  const nextReview = new Date(now);
  nextReview.setMonth(nextReview.getMonth() + 12);

  const updated = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(ropaEntry)
      .set({
        lastReviewed: now,
        nextReviewDate: nextReview.toISOString().split("T")[0],
        status: "active",
        updatedAt: now,
      })
      .where(eq(ropaEntry.id, id))
      .returning();
    return row;
  });

  return Response.json({ data: updated });
}
