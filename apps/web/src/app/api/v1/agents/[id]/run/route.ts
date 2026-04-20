import {
  db,
  agentRegistration,
  agentExecutionLog,
  agentRecommendation,
} from "@grc/db";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/agents/:id/run — Force run agent now
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  const [agent] = await db
    .select()
    .from(agentRegistration)
    .where(
      and(eq(agentRegistration.id, id), eq(agentRegistration.orgId, ctx.orgId)),
    );

  if (!agent) {
    return Response.json({ error: "Agent not found" }, { status: 404 });
  }

  if (agent.status === "running") {
    return Response.json(
      { error: "Agent is already running" },
      { status: 409 },
    );
  }

  const startTime = Date.now();

  // Set agent to running
  await db
    .update(agentRegistration)
    .set({ status: "running", updatedAt: new Date() })
    .where(eq(agentRegistration.id, id));

  try {
    // Execute agent lifecycle: observe -> evaluate -> recommend
    const observation = await observePhase(agent);
    const evaluation = await evaluatePhase(agent, observation);
    const recommendations = await recommendPhase(agent, evaluation);

    const durationMs = Date.now() - startTime;

    // Store execution log
    const result = await withAuditContext(ctx, async (tx) => {
      const [log] = await tx
        .insert(agentExecutionLog)
        .values({
          agentId: id,
          orgId: ctx.orgId,
          phase: "complete",
          observedData: observation,
          evaluation,
          recommendations,
          itemsFound: observation.itemCount ?? 0,
          recommendationsGenerated: recommendations.length,
          durationMs,
          aiTokensUsed: 0,
        })
        .returning();

      // Create recommendation records
      for (const rec of recommendations) {
        await tx.insert(agentRecommendation).values({
          agentId: id,
          orgId: ctx.orgId,
          severity: rec.severity ?? "info",
          title: rec.title ?? "Recommendation",
          reasoning: rec.reasoning ?? "",
          suggestedAction: rec.suggestedAction,
          entityType: rec.entityType,
          entityId: rec.entityId,
        });
      }

      // Update agent status
      const config = agent.config as Record<string, unknown>;
      const freq = (config.scanFrequencyMinutes as number) ?? 60;
      await tx
        .update(agentRegistration)
        .set({
          status: "idle",
          lastRunAt: new Date(),
          nextRunAt: new Date(Date.now() + freq * 60000),
          totalRunCount: agent.totalRunCount + 1,
          totalRecommendations:
            agent.totalRecommendations + recommendations.length,
          updatedAt: new Date(),
        })
        .where(eq(agentRegistration.id, id));

      return log;
    });

    return Response.json({ data: result }, { status: 201 });
  } catch (err) {
    // Set agent to error state
    await db
      .update(agentRegistration)
      .set({
        status: "error",
        errorMessage: err instanceof Error ? err.message : "Unknown error",
        updatedAt: new Date(),
      })
      .where(eq(agentRegistration.id, id));

    return Response.json({ error: "Agent execution failed" }, { status: 500 });
  }
}

// Agent phase implementations (simplified — real agents use AI)
async function observePhase(agent: typeof agentRegistration.$inferSelect) {
  const agentType = agent.agentType;
  switch (agentType) {
    case "evidence_review":
      return {
        phase: "observe",
        itemCount: 0,
        staleEvidence: [],
        recentUploads: [],
      };
    case "compliance_monitor":
      return {
        phase: "observe",
        itemCount: 0,
        regulatoryChanges: [],
        driftIndicators: [],
      };
    case "vendor_signal":
      return {
        phase: "observe",
        itemCount: 0,
        newsSignals: [],
        cveMatches: [],
      };
    case "sla_monitor":
      return {
        phase: "observe",
        itemCount: 0,
        upcomingDeadlines: [],
        overdueItems: [],
      };
    default:
      return { phase: "observe", itemCount: 0 };
  }
}

async function evaluatePhase(
  agent: typeof agentRegistration.$inferSelect,
  observation: Record<string, unknown>,
) {
  return { phase: "evaluate", significantFindings: 0, riskLevel: "low" };
}

async function recommendPhase(
  agent: typeof agentRegistration.$inferSelect,
  evaluation: Record<string, unknown>,
) {
  // Returns empty recommendations by default; real implementation uses AI
  return [] as {
    severity: string;
    title: string;
    reasoning: string;
    suggestedAction?: string;
    entityType?: string;
    entityId?: string;
  }[];
}
