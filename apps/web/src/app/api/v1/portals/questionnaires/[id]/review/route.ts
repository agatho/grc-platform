import { db, portalQuestionnaireResponse } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { reviewQuestionnaireSchema } from "@grc/shared";

// POST /api/v1/portals/questionnaires/:id/review
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;
  const body = reviewQuestionnaireSchema.parse(await req.json());

  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx.update(portalQuestionnaireResponse).set({
      status: body.status,
      reviewedBy: ctx.userId,
      reviewedAt: new Date(),
      reviewNotes: body.reviewNotes,
      updatedAt: new Date(),
    }).where(and(eq(portalQuestionnaireResponse.id, id), eq(portalQuestionnaireResponse.orgId, ctx.orgId))).returning();
    return updated;
  });
  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: result });
}
