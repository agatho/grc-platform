import { db, fairParameters, fairSimulationResult, risk } from "@grc/db";
import { requireModule } from "@grc/auth";
import { runSimulationSchema, runFAIRMonteCarlo } from "@grc/shared";
import type { FAIRParams } from "@grc/shared";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/erm/risks/:id/fair/simulate — Run Monte Carlo simulation
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: riskId } = await params;

  // Verify risk belongs to org
  const [riskRow] = await db
    .select({ id: risk.id })
    .from(risk)
    .where(
      and(
        eq(risk.id, riskId),
        eq(risk.orgId, ctx.orgId),
        isNull(risk.deletedAt),
      ),
    );

  if (!riskRow) {
    return Response.json({ error: "Risk not found" }, { status: 404 });
  }

  // Get FAIR parameters
  const [fairParams] = await db
    .select()
    .from(fairParameters)
    .where(
      and(
        eq(fairParameters.riskId, riskId),
        eq(fairParameters.orgId, ctx.orgId),
      ),
    );

  if (!fairParams) {
    return Response.json(
      {
        error:
          "FAIR parameters not configured for this risk. Set parameters first.",
      },
      { status: 400 },
    );
  }

  // Parse request body for iterations config
  let iterations = 10000;
  try {
    const body = await req.json();
    const parsed = runSimulationSchema.safeParse(body);
    if (parsed.success) {
      iterations = parsed.data.iterations;
    }
  } catch {
    // No body — use defaults
  }

  // Create pending simulation record
  const [simRecord] = await db
    .insert(fairSimulationResult)
    .values({
      riskId,
      orgId: ctx.orgId,
      parametersId: fairParams.id,
      iterations,
      status: "running",
      createdBy: ctx.userId,
    })
    .returning();

  try {
    // Run Monte Carlo simulation
    const simParams: FAIRParams = {
      lefMin: Number(fairParams.lefMin),
      lefMostLikely: Number(fairParams.lefMostLikely),
      lefMax: Number(fairParams.lefMax),
      lmMin: Number(fairParams.lmMin),
      lmMostLikely: Number(fairParams.lmMostLikely),
      lmMax: Number(fairParams.lmMax),
    };

    const result = runFAIRMonteCarlo(simParams, iterations);

    // Update simulation record with results
    const [updated] = await withAuditContext(ctx, async (tx) => {
      return tx
        .update(fairSimulationResult)
        .set({
          status: "completed" as const,
          aleP5: String(result.aleP5),
          aleP25: String(result.aleP25),
          aleP50: String(result.aleP50),
          aleP75: String(result.aleP75),
          aleP95: String(result.aleP95),
          aleMean: String(result.aleMean),
          aleStdDev: String(result.aleStdDev),
          histogram: result.histogram,
          lossExceedance: result.lossExceedance,
          sensitivity: result.sensitivity,
          computedAt: new Date(),
        })
        .where(eq(fairSimulationResult.id, simRecord.id))
        .returning();
    });

    return Response.json({ data: updated });
  } catch (err) {
    // Mark as failed
    const errorMessage = err instanceof Error ? err.message : String(err);
    await db
      .update(fairSimulationResult)
      .set({
        status: "failed" as const,
        errorMessage,
      })
      .where(eq(fairSimulationResult.id, simRecord.id));

    return Response.json(
      { error: "Simulation failed", message: errorMessage },
      { status: 500 },
    );
  }
}
