import { db, auditAnalyticsResult } from "@grc/db";
import { requireModule } from "@grc/auth";
import { createFindingFromAnalysisSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/audit-mgmt/analytics/results/:id/create-finding — Create finding from flagged items
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const body = await req.json();
  const parsed = createFindingFromAnalysisSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Verify result exists
  const [result] = await db
    .select()
    .from(auditAnalyticsResult)
    .where(
      and(
        eq(auditAnalyticsResult.id, id),
        eq(auditAnalyticsResult.orgId, ctx.orgId),
      ),
    );

  if (!result) {
    return Response.json({ error: "Analysis result not found" }, { status: 404 });
  }

  if (result.findingId) {
    return Response.json(
      { error: "Finding already created for this analysis result" },
      { status: 409 },
    );
  }

  const summary = result.summaryJson as { flaggedCount: number; totalAnalyzed: number };
  const title = parsed.data.title ?? `Analytics Finding: ${result.analysisType} — ${summary.flaggedCount} flagged items`;
  const description = parsed.data.description ??
    `Automated finding from ${result.analysisType} analysis. ${summary.flaggedCount} of ${summary.totalAnalyzed} items flagged for review.`;

  // Create finding would use the finding entity from Sprint 4/8
  // For now, simulate finding creation and link back
  const findingId = crypto.randomUUID();

  await withAuditContext(ctx, async (tx) => {
    await tx
      .update(auditAnalyticsResult)
      .set({ findingId })
      .where(eq(auditAnalyticsResult.id, id));
  });

  return Response.json({
    data: {
      findingId,
      title,
      description,
      linkedAnalysisResultId: id,
    },
  }, { status: 201 });
}
