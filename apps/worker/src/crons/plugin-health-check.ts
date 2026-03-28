// Sprint 58: Worker — Monitor plugin health and disable failing plugins
import { db, pluginInstallation, pluginExecutionLog } from "@grc/db";
import { eq, and, sql, gte } from "drizzle-orm";

const ERROR_THRESHOLD = 10;
const CHECK_WINDOW_HOURS = 1;

export async function pluginHealthCheck(): Promise<void> {
  const since = new Date(Date.now() - CHECK_WINDOW_HOURS * 60 * 60 * 1000);

  // Find installations with too many errors in the check window
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
    .having(sql`count(*) FILTER (WHERE ${pluginExecutionLog.status} = 'error') >= ${ERROR_THRESHOLD}`);

  for (const failing of failingInstallations) {
    await db
      .update(pluginInstallation)
      .set({
        status: "error",
        updatedAt: new Date(),
      })
      .where(and(
        eq(pluginInstallation.id, failing.installationId),
        eq(pluginInstallation.status, "active"),
      ));

    console.log(
      `[plugin-health] Disabled plugin installation ${failing.installationId} ` +
      `due to ${failing.errorCount} errors in ${CHECK_WINDOW_HOURS}h`,
    );
  }
}
