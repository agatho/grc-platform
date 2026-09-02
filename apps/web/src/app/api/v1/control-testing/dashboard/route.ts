import {
  db,
  controlTestScript,
  controlTestExecution,
  controlTestChecklist,
  controlTestLearning,
} from "@grc/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/control-testing/dashboard
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth(
    "admin",
    "control_owner",
    "auditor",
    "risk_manager",
  );
  if (ctx instanceof Response) return ctx;

  const [scriptStats] = await db
    .select({
      totalScripts: sql<number>`count(*)`,
      activeScripts: sql<number>`count(*) filter (where ${controlTestScript.isActive} = true)`,
    })
    .from(controlTestScript)
    .where(eq(controlTestScript.orgId, ctx.orgId));

  const [execStats] = await db
    .select({
      totalExecutions: sql<number>`count(*)`,
      passRate: sql<number>`round(count(*) filter (where ${controlTestExecution.result} = 'pass')::numeric / nullif(count(*) filter (where ${controlTestExecution.result} is not null), 0) * 100, 1)`,
      failRate: sql<number>`round(count(*) filter (where ${controlTestExecution.result} = 'fail')::numeric / nullif(count(*) filter (where ${controlTestExecution.result} is not null), 0) * 100, 1)`,
    })
    .from(controlTestExecution)
    .where(eq(controlTestExecution.orgId, ctx.orgId));

  const [checklistStats] = await db
    .select({
      totalChecklists: sql<number>`count(*)`,
      overdueChecklists: sql<number>`count(*) filter (where ${controlTestChecklist.dueDate} < now() and ${controlTestChecklist.status} != 'completed')`,
    })
    .from(controlTestChecklist)
    .where(eq(controlTestChecklist.orgId, ctx.orgId));

  const [learningStats] = await db
    .select({ learningPatterns: sql<number>`count(*)` })
    .from(controlTestLearning)
    .where(eq(controlTestLearning.orgId, ctx.orgId));

  const recentExecutions = await db
    .select()
    .from(controlTestExecution)
    .where(eq(controlTestExecution.orgId, ctx.orgId))
    .orderBy(desc(controlTestExecution.createdAt))
    .limit(10);

  return Response.json({
    data: {
      ...scriptStats,
      ...execStats,
      ...checklistStats,
      ...learningStats,
      recentExecutions,
    },
  });
});
