import { db, portalQuestionnaireResponse } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { submitQuestionnaireResponseSchema } from "@grc/shared";

// GET /api/v1/portals/questionnaires/:id
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const { id } = await params;
  const [row] = await db
    .select()
    .from(portalQuestionnaireResponse)
    .where(
      and(
        eq(portalQuestionnaireResponse.id, id),
        eq(portalQuestionnaireResponse.orgId, ctx.orgId),
      ),
    );
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: row });
}

// PATCH /api/v1/portals/questionnaires/:id — save progress or submit
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const { id } = await params;
  const body = submitQuestionnaireResponseSchema.parse(await req.json());

  const isSubmitting = body.progressPct === 100;
  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx
      .update(portalQuestionnaireResponse)
      .set({
        answersJson: body.answersJson,
        progressPct: body.progressPct,
        status: isSubmitting ? "submitted" : "in_progress",
        submittedAt: isSubmitting ? new Date() : undefined,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(portalQuestionnaireResponse.id, id),
          eq(portalQuestionnaireResponse.orgId, ctx.orgId),
        ),
      )
      .returning();
    return updated;
  });
  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: result });
}
