import { db, processSimulationResult, simulationScenario } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/processes/:id/simulation/compare?scenarioA=...&scenarioB=...
// [ARCTOS-FULL-2026-08-31 / Welle 4b-4 · OP-180] Das Pfadsegment `:id` (der
// Prozess) wurde nicht ausgewertet: verglichen wurden zwei Szenarien allein
// nach `?scenarioA/B=` und `org_id`. Damit liessen sich Szenarien
// VERSCHIEDENER Prozesse derselben Organisation gegeneinanderstellen — die
// Antwort trug den Prozess im Pfad und meinte ihn nicht. Beide Ergebnisse
// werden jetzt ueber `simulation_scenario` an den Prozess gebunden
// (`simulation_scenario.process_id`, der einzige Weg vom Ergebnis zum
// Prozess: `process_simulation_result.scenario_id` → `simulation_scenario`).
export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "process_owner", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { orgId } = ctx;
  const { id: processId } = await params;

  const url = new URL(req.url);
  const scenarioA = url.searchParams.get("scenarioA");
  const scenarioB = url.searchParams.get("scenarioB");

  if (!scenarioA || !scenarioB) {
    return Response.json(
      { error: "scenarioA and scenarioB query params required" },
      { status: 422 },
    );
  }

  /**
   * Ein Simulationsergebnis DIESES Prozesses. Der Prozessbezug haengt am
   * Szenario, nicht am Ergebnis — deshalb der Verbund. Die Sortierung
   * (`executedAt` aufsteigend, also der AELTESTE Lauf) ist unveraendert
   * uebernommen; ob ein Vergleich den ersten oder den letzten Lauf meint,
   * ist eine Produktfrage und nicht Gegenstand von OP-180.
   */
  async function resultOfProcess(scenarioId: string) {
    const [row] = await db
      .select({ result: processSimulationResult })
      .from(processSimulationResult)
      .innerJoin(
        simulationScenario,
        eq(simulationScenario.id, processSimulationResult.scenarioId),
      )
      .where(
        and(
          eq(processSimulationResult.scenarioId, scenarioId),
          eq(processSimulationResult.orgId, orgId),
          eq(simulationScenario.orgId, orgId),
          eq(simulationScenario.processId, processId),
        ),
      )
      .orderBy(processSimulationResult.executedAt)
      .limit(1);
    return row?.result;
  }

  const [resultA, resultB] = await Promise.all([
    resultOfProcess(scenarioA),
    resultOfProcess(scenarioB),
  ]);

  if (!resultA || !resultB) {
    return Response.json(
      {
        error: "One or both scenarios have no results for this process",
      },
      { status: 404 },
    );
  }

  const comparison = {
    scenarioA: resultA,
    scenarioB: resultB,
    delta: {
      avgCycleTime:
        parseFloat(resultB.avgCycleTime as string) -
        parseFloat(resultA.avgCycleTime as string),
      p95CycleTime:
        parseFloat(resultB.p95CycleTime as string) -
        parseFloat(resultA.p95CycleTime as string),
      avgCost:
        parseFloat(resultB.avgCost as string) -
        parseFloat(resultA.avgCost as string),
      avgCycleTimePct: resultA.avgCycleTime
        ? ((parseFloat(resultB.avgCycleTime as string) -
            parseFloat(resultA.avgCycleTime as string)) /
            parseFloat(resultA.avgCycleTime as string)) *
          100
        : 0,
    },
  };

  return Response.json({ data: comparison });
});
