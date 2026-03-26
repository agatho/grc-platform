import {
  db,
  controlEffectivenessScore,
  control,
  controlTest,
  finding,
} from "@grc/db";
import { eq, and, isNull, desc, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { cesRecomputeSchema, computeCES, computeTrend } from "@grc/shared";

// POST /api/v1/ics/ces/recompute — Force recompute all or selected CES scores
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const body = cesRecomputeSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // 1. Fetch controls to recompute
  const controlConditions = [
    eq(control.orgId, ctx.orgId),
    isNull(control.deletedAt),
  ];

  if (body.data.controlIds?.length) {
    controlConditions.push(inArray(control.id, body.data.controlIds));
  }

  const controls = await db
    .select({
      id: control.id,
      automationLevel: control.automationLevel,
    })
    .from(control)
    .where(and(...controlConditions));

  let computed = 0;

  for (const ctrl of controls) {
    // Fetch last 4 test results
    const tests = await db
      .select({
        result: controlTest.todResult,
        executedDate: controlTest.testDate,
      })
      .from(controlTest)
      .where(
        and(
          eq(controlTest.controlId, ctrl.id),
          eq(controlTest.orgId, ctx.orgId),
        ),
      )
      .orderBy(desc(controlTest.testDate))
      .limit(4);

    // Fetch open findings
    const openFindings = await db
      .select({ severity: finding.severity })
      .from(finding)
      .where(
        and(
          eq(finding.controlId, ctrl.id),
          eq(finding.orgId, ctx.orgId),
          isNull(finding.deletedAt),
          sql`${finding.status} NOT IN ('closed', 'verified')`,
        ),
      );

    // Get last test date
    const lastTestDate =
      tests.length > 0 && tests[0].executedDate
        ? new Date(tests[0].executedDate).toISOString()
        : null;

    const cesResult = computeCES({
      testResults: tests
        .filter((t) => t.result)
        .map((t) => ({
          result: t.result!,
          executedDate: t.executedDate
            ? new Date(t.executedDate).toISOString()
            : new Date().toISOString(),
        })),
      openFindings: openFindings.map((f) => ({ severity: f.severity })),
      automationLevel: ctrl.automationLevel,
      lastTestDate,
    });

    // Check for existing score to determine trend
    const [existing] = await db
      .select({
        score: controlEffectivenessScore.score,
      })
      .from(controlEffectivenessScore)
      .where(
        and(
          eq(controlEffectivenessScore.controlId, ctrl.id),
          eq(controlEffectivenessScore.orgId, ctx.orgId),
        ),
      )
      .limit(1);

    const previousScore = existing?.score ?? null;
    const trend = computeTrend(cesResult.score, previousScore);

    // Upsert CES
    await db
      .insert(controlEffectivenessScore)
      .values({
        orgId: ctx.orgId,
        controlId: ctrl.id,
        score: cesResult.score,
        testScoreAvg: String(cesResult.testScoreAvg),
        overduePenalty: String(cesResult.overduePenalty),
        findingPenalty: String(cesResult.findingPenalty),
        automationBonus: String(cesResult.automationBonus),
        openFindingsCount: openFindings.length,
        lastTestAt: lastTestDate ? new Date(lastTestDate) : null,
        lastComputedAt: new Date(),
        trend,
        previousScore,
      })
      .onConflictDoUpdate({
        target: [controlEffectivenessScore.orgId, controlEffectivenessScore.controlId],
        set: {
          score: cesResult.score,
          testScoreAvg: String(cesResult.testScoreAvg),
          overduePenalty: String(cesResult.overduePenalty),
          findingPenalty: String(cesResult.findingPenalty),
          automationBonus: String(cesResult.automationBonus),
          openFindingsCount: openFindings.length,
          lastTestAt: lastTestDate ? new Date(lastTestDate) : null,
          lastComputedAt: new Date(),
          trend,
          previousScore,
          updatedAt: new Date(),
        },
      });

    computed++;
  }

  return Response.json({
    success: true,
    computed,
    total: controls.length,
  });
}
