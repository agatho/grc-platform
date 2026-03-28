import { db, soaAiSuggestion } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { reviewSoaSuggestionSchema } from "@grc/shared";

// PUT /api/v1/isms/soa/ai-gap-analysis/:id — Accept or reject a gap suggestion
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const body = await req.json();
  const parsed = reviewSoaSuggestionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(soaAiSuggestion)
    .where(and(eq(soaAiSuggestion.id, id), eq(soaAiSuggestion.orgId, ctx.orgId)))
    .limit(1);

  if (!existing) {
    return Response.json({ error: "Suggestion not found" }, { status: 404 });
  }

  if (existing.status !== "pending") {
    return Response.json({ error: "Suggestion already reviewed" }, { status: 409 });
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx
      .update(soaAiSuggestion)
      .set({
        status: parsed.data.status,
        suggestedControlId: parsed.data.controlId ?? existing.suggestedControlId,
        reviewedBy: ctx.userId,
        reviewedAt: new Date(),
      })
      .where(and(eq(soaAiSuggestion.id, id), eq(soaAiSuggestion.orgId, ctx.orgId)))
      .returning();
    return updated;
  });

  return Response.json({ data: result });
}
