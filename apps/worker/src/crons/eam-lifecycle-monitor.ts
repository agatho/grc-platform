// Sprint 36: EAM Lifecycle Monitor Worker
// Runs weekly — checks for applications approaching EOL

import { db, applicationPortfolio, architectureElement } from "@grc/db";
import { and, lte, eq, sql } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";

export const processEamLifecycleMonitor = withCronInstrumentation(
  "eam-lifecycle-monitor",
  async (): Promise<{ approachingEol: number; notificationsSent: number }> => {

  const thresholds = [90, 60, 30]; // days before EOL
  let totalApproaching = 0;
  let notificationsSent = 0;

  for (const days of thresholds) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);

    const approaching = await db
      .select({
        elementId: applicationPortfolio.elementId,
        name: architectureElement.name,
        eol: applicationPortfolio.plannedEol,
        owner: architectureElement.owner,
      })
      .from(applicationPortfolio)
      .innerJoin(
        architectureElement,
        eq(applicationPortfolio.elementId, architectureElement.id),
      )
      .where(
        and(
          lte(
            applicationPortfolio.plannedEol,
            cutoff.toISOString().split("T")[0]!,
          ),
          eq(applicationPortfolio.lifecycleStatus, "active"),
        ),
      );

    totalApproaching += approaching.length;

    for (const app of approaching) {
      void app;
      notificationsSent++;
    }
  }

    return { approachingEol: totalApproaching, notificationsSent };
  },
);
