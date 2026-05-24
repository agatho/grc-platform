// Sprint 58: Worker — Monitor plugin health and disable failing plugins
import { db, pluginInstallation, pluginExecutionLog } from "@grc/db";
import { eq, and, sql, gte } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";

const ERROR_THRESHOLD = 10;
const CHECK_WINDOW_HOURS = 1;

export const pluginHealthCheck = withCronInstrumentation(
  "plugin-health-check",
  async (): Promise<void> => {
    const since = new Date(Date.now() - CHECK_WINDOW_HOURS * 60 * 60 * 1000);

    const failingInstallations = await db
      .select({
        installationId: pluginExecutionLog.installationId,
        orgId: pluginExecutionLog.orgId,
        errorCount: sql<number>`count(*) FILTER (WHERE ${pluginExecutionLog.status} = 'error')`,
        totalCount: sql<number>`count(*)`,
      })
      .from(pluginExecutionLog)
      .where(gte(pluginExecutionLog.createdAt, since))
      .groupBy(pluginExecutionLog.installationId, pluginExecutionLog.orgId)
      .having(
        sql`count(*) FILTER (WHERE ${pluginExecutionLog.status} = 'error') >= ${ERROR_THRESHOLD}`,
      );

    for (const failing of failingInstallations) {
      await db
        .update(pluginInstallation)
        .set({
          status: "error",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(pluginInstallation.id, failing.installationId),
            eq(pluginInstallation.status, "active"),
          ),
        );
    }
  },
);
