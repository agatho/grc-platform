import { db, maturityRoadmapAction } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql, desc, asc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { updateRoadmapActionStatusSchema } from "@grc/shared";

// GET /api/v1/isms/maturity/roadmap — Get latest roadmap
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // Get latest roadmap run
  const [latestRun] = await db
    .select({ roadmapRunId: maturityRoadmapAction.roadmapRunId })
    .from(maturityRoadmapAction)
    .where(eq(maturityRoadmapAction.orgId, ctx.orgId))
    .orderBy(desc(maturityRoadmapAction.createdAt))
    .limit(1);

  if (!latestRun) {
    return Response.json({
      data: { roadmapRunId: null, actions: [], totalActions: 0, quickWins: 0 },
    });
  }

  const actions = await db
    .select()
    .from(maturityRoadmapAction)
    .where(
      and(
        eq(maturityRoadmapAction.orgId, ctx.orgId),
        eq(maturityRoadmapAction.roadmapRunId, latestRun.roadmapRunId),
      ),
    )
    .orderBy(
      desc(maturityRoadmapAction.isQuickWin),
      asc(maturityRoadmapAction.priority),
    );

  // Group by quarter for timeline view
  const byQuarter: Record<string, typeof actions> = {};
  for (const action of actions) {
    const q = action.quarter ?? "Unassigned";
    if (!byQuarter[q]) byQuarter[q] = [];
    byQuarter[q].push(action);
  }

  return Response.json({
    data: {
      roadmapRunId: latestRun.roadmapRunId,
      totalActions: actions.length,
      quickWins: actions.filter(a => a.isQuickWin).length,
      actions,
      byQuarter,
    },
  });
}

// PUT /api/v1/isms/maturity/roadmap — Update action status
export async function PUT(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const { actionId, ...statusBody } = body;
  const parsed = updateRoadmapActionStatusSchema.safeParse(statusBody);
  if (!parsed.success || !actionId) {
    return Response.json({ error: "Validation failed" }, { status: 400 });
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx
      .update(maturityRoadmapAction)
      .set({ status: parsed.data.status })
      .where(
        and(
          eq(maturityRoadmapAction.id, actionId),
          eq(maturityRoadmapAction.orgId, ctx.orgId),
        ),
      )
      .returning();
    return updated;
  });

  if (!result) {
    return Response.json({ error: "Action not found" }, { status: 404 });
  }

  return Response.json({ data: result });
}
