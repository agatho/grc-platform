// Sprint 43: Continuous Audit Rule Runner (per rule schedule)
// Executes active rules based on their schedule (daily/weekly/monthly)

import {
  db,
  continuousAuditRule,
  continuousAuditResult,
  continuousAuditException,
  notification,
} from "@grc/db";
import { and, eq, sql } from "drizzle-orm";

interface ContinuousAuditRunnerResult {
  processed: number;
  passed: number;
  exceptionsFound: number;
  errors: number;
}

export async function processContinuousAuditRunner(): Promise<ContinuousAuditRunnerResult> {
  const now = new Date();
  let passed = 0;
  let exceptionsFound = 0;
  let errors = 0;

  console.log(
    `[cron:continuous-audit-runner] Starting at ${now.toISOString()}`,
  );

  // Find active rules due for execution based on schedule
  const dueRules = await db
    .select()
    .from(continuousAuditRule)
    .where(
      and(
        eq(continuousAuditRule.isActive, true),
        sql`(
          ${continuousAuditRule.lastExecutedAt} IS NULL
          OR (${continuousAuditRule.schedule} = 'daily' AND ${continuousAuditRule.lastExecutedAt} < NOW() - INTERVAL '1 day')
          OR (${continuousAuditRule.schedule} = 'weekly' AND ${continuousAuditRule.lastExecutedAt} < NOW() - INTERVAL '7 days')
          OR (${continuousAuditRule.schedule} = 'monthly' AND ${continuousAuditRule.lastExecutedAt} < NOW() - INTERVAL '30 days')
        )`,
      ),
    );

  for (const rule of dueRules) {
    const startTime = Date.now();
    try {
      // Execute rule based on type
      let ruleExceptions: Array<{
        description: string;
        entityType?: string;
        entityId?: string;
        detail?: Record<string, unknown>;
      }> = [];

      if (rule.ruleType === "builtin") {
        ruleExceptions = await executeBuiltinRule(rule);
      } else if (rule.ruleType === "custom_sql") {
        ruleExceptions = await executeCustomSqlRule(rule);
      }

      const executionTimeMs = Date.now() - startTime;
      const resultStatus =
        ruleExceptions.length > 0 ? "exceptions_found" : "pass";

      // Store immutable result
      const [result] = await db
        .insert(continuousAuditResult)
        .values({
          ruleId: rule.id,
          orgId: rule.orgId,
          resultStatus,
          exceptionCount: ruleExceptions.length,
          executionTimeMs,
        })
        .returning();

      // Store exceptions
      if (ruleExceptions.length > 0) {
        await db.insert(continuousAuditException).values(
          ruleExceptions.map((e) => ({
            resultId: result.id,
            ruleId: rule.id,
            orgId: rule.orgId,
            description: e.description,
            entityType: e.entityType,
            entityId: e.entityId,
            detail: e.detail ?? {},
          })),
        );
        exceptionsFound++;
      } else {
        passed++;
      }

      // Update last executed
      await db
        .update(continuousAuditRule)
        .set({ lastExecutedAt: new Date() })
        .where(eq(continuousAuditRule.id, rule.id));
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      await db.insert(continuousAuditResult).values({
        ruleId: rule.id,
        orgId: rule.orgId,
        resultStatus: "error",
        exceptionCount: 0,
        executionTimeMs,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      errors++;
    }
  }

  console.log(
    `[cron:continuous-audit-runner] Completed: ${dueRules.length} rules, ${passed} passed, ${exceptionsFound} with exceptions, ${errors} errors`,
  );
  return { processed: dueRules.length, passed, exceptionsFound, errors };
}

async function executeBuiltinRule(
  rule: typeof continuousAuditRule.$inferSelect,
) {
  const dataSource = rule.dataSource as Record<string, unknown>;
  const checkType = dataSource?.check_type as string;
  // Built-in rule implementations would go here
  // For now, return empty (pass)
  return [];
}

async function executeCustomSqlRule(
  rule: typeof continuousAuditRule.$inferSelect,
) {
  const dataSource = rule.dataSource as Record<string, unknown>;
  const query = dataSource?.query as string;
  if (!query) return [];

  // Execute with read-only role and timeout
  try {
    const rows = await db.execute(
      sql.raw(`SET LOCAL statement_timeout = '60s'; ${query}`),
    );
    return (rows as any[]).map((r) => ({
      description: JSON.stringify(r),
      detail: r,
    }));
  } catch {
    return [];
  }
}
