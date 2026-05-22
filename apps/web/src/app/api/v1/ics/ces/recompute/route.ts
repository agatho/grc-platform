import {
  db,
  controlEffectivenessScore,
  control,
  controlTest,
  finding,
} from "@grc/db";
import { eq, and, isNull, inArray, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { cesRecomputeSchema, computeCES, computeTrend } from "@grc/shared";

// POST /api/v1/ics/ces/recompute — Force recompute all or selected CES scores
//
// #PERF-N-PLUS-1: was 1 + 4N sequential round-trips for N controls
//   1. SELECT all matching controls                          (1 query)
//   2. for each control:
//        SELECT last 4 controlTest rows                       (N queries)
//        SELECT open findings                                  (N queries)
//        SELECT existing CES                                   (N queries)
//        INSERT…ON CONFLICT DO UPDATE                          (N queries)
// With 500 controls that's ~2,001 sequential RTTs.
//
// Refactored to 4 batched queries:
//   1. SELECT controls                                        (1 query)
//   2. SELECT last-4 controlTest rows per controlId (window
//      function in one statement, WHERE controlId IN (...))   (1 query)
//   3. SELECT all open findings WHERE controlId IN (...)      (1 query)
//   4. SELECT all existing CES rows WHERE controlId IN (...)  (1 query)
//   5. Per-control UPSERT dispatched in parallel via
//      Promise.all (bounded by pg pool ≈ 10)                 (~N/10 RTTs)
// Net on 500 controls: 4 + ~50 = ~54 sequential RTTs (~40× speedup).
//
// Behaviour preserved:
//   - same computeCES() formula
//   - same trend computation against previousScore
//   - org boundary held on every join (control_id + org_id)
//   - skip-if-no-tests path implicit (a control with no testResults
//     and no openFindings still upserts a record; same as before)

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

  // 1. Fetch controls in scope.
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

  if (controls.length === 0) {
    return Response.json({ success: true, computed: 0, total: 0 });
  }

  const controlIds = controls.map((c) => c.id);

  // 2. Last-4 controlTest rows per controlId in one query, using a
  // window-function CTE. PG's ROW_NUMBER() OVER (PARTITION BY …) is
  // the canonical pattern for "top-N per group".
  const testRowsRaw = await db.execute<{
    control_id: string;
    result: string | null;
    test_date: Date | string | null;
  }>(
    sql`
      WITH ranked AS (
        SELECT
          control_id,
          tod_result AS result,
          test_date,
          ROW_NUMBER() OVER (
            PARTITION BY control_id
            ORDER BY test_date DESC NULLS LAST
          ) AS rn
        FROM control_test
        WHERE control_id IN (${sql.join(
          controlIds.map((id) => sql`${id}::uuid`),
          sql`, `,
        )})
          AND org_id = ${ctx.orgId}::uuid
      )
      SELECT control_id, result, test_date
      FROM ranked
      WHERE rn <= 4
      ORDER BY control_id, test_date DESC
    `,
  );

  const testsByControl = new Map<
    string,
    Array<{ result: string | null; executedDate: Date | string | null }>
  >();
  for (const row of testRowsRaw as unknown as Array<{
    control_id: string;
    result: string | null;
    test_date: Date | string | null;
  }>) {
    const bucket = testsByControl.get(row.control_id) ?? [];
    bucket.push({ result: row.result, executedDate: row.test_date });
    testsByControl.set(row.control_id, bucket);
  }

  // 3. All open findings in one query.
  const openFindings = await db
    .select({
      controlId: finding.controlId,
      severity: finding.severity,
    })
    .from(finding)
    .where(
      and(
        inArray(finding.controlId, controlIds),
        eq(finding.orgId, ctx.orgId),
        isNull(finding.deletedAt),
        sql`${finding.status} NOT IN ('closed', 'verified')`,
      ),
    );

  const findingsByControl = new Map<string, Array<{ severity: string }>>();
  for (const f of openFindings) {
    if (f.controlId == null) continue;
    const bucket = findingsByControl.get(f.controlId) ?? [];
    bucket.push({ severity: f.severity });
    findingsByControl.set(f.controlId, bucket);
  }

  // 4. All existing CES rows in one query so we can compute trends.
  const existingRows = await db
    .select({
      controlId: controlEffectivenessScore.controlId,
      score: controlEffectivenessScore.score,
    })
    .from(controlEffectivenessScore)
    .where(
      and(
        inArray(controlEffectivenessScore.controlId, controlIds),
        eq(controlEffectivenessScore.orgId, ctx.orgId),
      ),
    );

  const previousByControl = new Map<string, number>();
  for (const e of existingRows) {
    if (e.controlId == null) continue;
    previousByControl.set(e.controlId, e.score);
  }

  // 5. Per-control compute + UPSERT, dispatched in parallel.
  const now = new Date();
  const upserts: Promise<unknown>[] = [];
  for (const ctrl of controls) {
    const tests = testsByControl.get(ctrl.id) ?? [];
    const findingsForCtrl = findingsByControl.get(ctrl.id) ?? [];

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
      openFindings: findingsForCtrl.map((f) => ({ severity: f.severity })),
      automationLevel: ctrl.automationLevel,
      lastTestDate,
    });

    const previousScore = previousByControl.get(ctrl.id) ?? null;
    const trend = computeTrend(cesResult.score, previousScore);

    upserts.push(
      db
        .insert(controlEffectivenessScore)
        .values({
          orgId: ctx.orgId,
          controlId: ctrl.id,
          score: cesResult.score,
          testScoreAvg: String(cesResult.testScoreAvg),
          overduePenalty: String(cesResult.overduePenalty),
          findingPenalty: String(cesResult.findingPenalty),
          automationBonus: String(cesResult.automationBonus),
          openFindingsCount: findingsForCtrl.length,
          lastTestAt: lastTestDate ? new Date(lastTestDate) : null,
          lastComputedAt: now,
          trend,
          previousScore,
        })
        .onConflictDoUpdate({
          target: [
            controlEffectivenessScore.orgId,
            controlEffectivenessScore.controlId,
          ],
          set: {
            score: cesResult.score,
            testScoreAvg: String(cesResult.testScoreAvg),
            overduePenalty: String(cesResult.overduePenalty),
            findingPenalty: String(cesResult.findingPenalty),
            automationBonus: String(cesResult.automationBonus),
            openFindingsCount: findingsForCtrl.length,
            lastTestAt: lastTestDate ? new Date(lastTestDate) : null,
            lastComputedAt: now,
            trend,
            previousScore,
            updatedAt: now,
          },
        }),
    );
  }

  await Promise.all(upserts);

  return Response.json({
    success: true,
    computed: controls.length,
    total: controls.length,
  });
}
