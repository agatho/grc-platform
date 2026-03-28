import { db, marketplaceListing } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { changeListingStatusSchema } from "@grc/shared";

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ["pending_review"],
  pending_review: ["published", "rejected"],
  published: ["suspended", "deprecated"],
  suspended: ["published", "deprecated"],
  rejected: ["draft"],
  deprecated: [],
};

// PATCH /api/v1/marketplace/listings/:id/status
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;
  const body = changeListingStatusSchema.parse(await req.json());

  const [existing] = await db.select().from(marketplaceListing)
    .where(and(eq(marketplaceListing.id, id), eq(marketplaceListing.orgId, ctx.orgId)));
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

  const allowed = VALID_TRANSITIONS[existing.status] ?? [];
  if (!allowed.includes(body.status)) {
    return Response.json({ error: `Invalid transition from ${existing.status} to ${body.status}` }, { status: 422 });
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx.update(marketplaceListing).set({
      status: body.status,
      publishedAt: body.status === "published" ? new Date() : existing.publishedAt,
      updatedAt: new Date(),
    }).where(eq(marketplaceListing.id, id)).returning();
    return updated;
  });

  return Response.json({ data: result });
}
