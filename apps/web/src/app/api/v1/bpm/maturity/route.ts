import {
  db,
  processMaturityAssessment,
  processMaturityQuestionnaire,
} from "@grc/db";
import {
  submitMaturityAssessmentSchema,
  computeMaturityLevel,
  generateGapActions,
} from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/bpm/maturity/questionnaire — Shared questionnaire template
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth("admin", "process_owner", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const processId = url.searchParams.get("processId");

  // If processId: return latest assessment
  if (processId) {
    const [assessment] = await db
      .select()
      .from(processMaturityAssessment)
      .where(
        and(
          eq(processMaturityAssessment.orgId, ctx.orgId),
          eq(processMaturityAssessment.processId, processId),
        ),
      )
      .orderBy(desc(processMaturityAssessment.assessmentDate))
      .limit(1);
    return Response.json({ data: assessment || null });
  }

  // Otherwise: return questionnaire template
  const questions = await db.select().from(processMaturityQuestionnaire);
  return Response.json({ data: questions });
});
// POST /api/v1/bpm/maturity — Submit assessment
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin", "process_owner");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = submitMaturityAssessmentSchema.safeParse(await req.json());
  if (!body.success)
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );

  const overallLevel = computeMaturityLevel(body.data.dimensionScores);
  const gapActions = body.data.targetLevel
    ? generateGapActions(body.data.dimensionScores, body.data.targetLevel)
    : [];

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(processMaturityAssessment)
      .values({
        orgId: ctx.orgId,
        processId: body.data.processId,
        assessmentDate: body.data.assessmentDate,
        overallLevel,
        dimensionScores: body.data.dimensionScores,
        targetLevel: body.data.targetLevel,
        gapActions,
        assessorId: ctx.userId,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
});
