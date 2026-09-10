import { db, riskEvaluationLog, user } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/risks/:id/evaluation-log — Phase transition history
export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "control_owner",
    "process_owner",
    "auditor",
    "viewer",
  );
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: riskId } = await params;

  const logs = await db
    .select({
      id: riskEvaluationLog.id,
      riskId: riskEvaluationLog.riskId,
      oldPhase: riskEvaluationLog.oldPhase,
      newPhase: riskEvaluationLog.newPhase,
      transitionedBy: riskEvaluationLog.transitionedBy,
      transitionedByName: user.name,
      justification: riskEvaluationLog.justification,
      createdAt: riskEvaluationLog.createdAt,
    })
    .from(riskEvaluationLog)
    .leftJoin(user, eq(riskEvaluationLog.transitionedBy, user.id))
    .where(
      and(
        eq(riskEvaluationLog.riskId, riskId),
        eq(riskEvaluationLog.orgId, ctx.orgId),
      ),
    )
    .orderBy(desc(riskEvaluationLog.createdAt));

  return Response.json({ data: logs });
});
