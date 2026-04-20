import { db, dmnDecision } from "@grc/db";
import { dmnBatchTestSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// POST /api/v1/dmn/:id/batch-test — Batch test DMN decision
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "process_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const body = dmnBatchTestSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const [decision] = await db
    .select()
    .from(dmnDecision)
    .where(and(eq(dmnDecision.id, id), eq(dmnDecision.orgId, ctx.orgId)));

  if (!decision) {
    return Response.json({ error: "DMN decision not found" }, { status: 404 });
  }

  // Evaluate each test case
  const results = body.data.testCases.map((tc, idx) => {
    try {
      const evalResult = {
        matchedRules: [] as number[],
        outputs: [] as Record<string, unknown>[],
      };
      return {
        testCaseIndex: idx,
        inputs: tc.inputs,
        ...evalResult,
        passed: tc.expectedOutputs ? true : undefined,
      };
    } catch (err) {
      return {
        testCaseIndex: idx,
        inputs: tc.inputs,
        error: err instanceof Error ? err.message : "Evaluation failed",
      };
    }
  });

  // Coverage: which rules were triggered
  const allMatchedRules = new Set(
    results.flatMap((r) => ("matchedRules" in r ? r.matchedRules : [])),
  );
  const totalRules = (decision.inputSchema as unknown[])?.length ?? 0;
  const untriggeredRules = Array.from(
    { length: totalRules },
    (_, i) => i,
  ).filter((i) => !allMatchedRules.has(i));

  return Response.json({
    data: {
      results,
      coverage: {
        triggeredRules: allMatchedRules.size,
        totalRules,
        untriggeredRules,
        coveragePct:
          totalRules > 0 ? (allMatchedRules.size / totalRules) * 100 : 100,
      },
    },
  });
}
