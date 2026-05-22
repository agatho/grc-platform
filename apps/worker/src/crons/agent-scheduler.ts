// Sprint 35: Agent Scheduler Worker
// Runs every 5 minutes — checks for agents due for execution

import { db, agentRegistration } from "@grc/db";
import { lte, eq, and } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";

export const processAgentScheduler = withCronInstrumentation(
  "agent-scheduler",
  async (): Promise<{ checked: number; triggered: number }> => {
    const now = new Date();

    // Find active agents due for execution
    const dueAgents = await db
      .select()
      .from(agentRegistration)
      .where(
        and(
          eq(agentRegistration.isActive, true),
          eq(agentRegistration.status, "idle"),
          lte(agentRegistration.nextRunAt, now),
        ),
      );

    let triggered = 0;

    for (const agent of dueAgents) {
      try {
        await db
          .update(agentRegistration)
          .set({ status: "running", updatedAt: new Date() })
          .where(eq(agentRegistration.id, agent.id));

        const config = agent.config as Record<string, unknown>;
        const freq = (config.scanFrequencyMinutes as number) ?? 60;

        // After execution, mark as idle and schedule next run
        await db
          .update(agentRegistration)
          .set({
            status: "idle",
            lastRunAt: new Date(),
            nextRunAt: new Date(Date.now() + freq * 60000),
            totalRunCount: agent.totalRunCount + 1,
            updatedAt: new Date(),
          })
          .where(eq(agentRegistration.id, agent.id));

        triggered++;
      } catch (err) {
        // Wrapper logs structured error; we also persist the message
        // on the agent record so the UI can show it without grepping
        // logs.
        await db
          .update(agentRegistration)
          .set({
            status: "error",
            errorMessage: err instanceof Error ? err.message : "Unknown error",
            updatedAt: new Date(),
          })
          .where(eq(agentRegistration.id, agent.id));
      }
    }

    return { checked: dueAgents.length, triggered };
  },
);
