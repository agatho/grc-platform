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
import { validateCustomAuditSql } from "@grc/shared";
import { withCronInstrumentation } from "../lib/cron-instrument";

interface ContinuousAuditRunnerResult {
  processed: number;
  passed: number;
  exceptionsFound: number;
  errors: number;
}

export const processContinuousAuditRunner = withCronInstrumentation(
  "continuous-audit-runner",
  async (): Promise<ContinuousAuditRunnerResult> => {
    const now = new Date();
    void now;
    let passed = 0;
    let exceptionsFound = 0;
    let errors = 0;

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

    return { processed: dueRules.length, passed, exceptionsFound, errors };
  },
);

async function executeBuiltinRule(
  rule: typeof continuousAuditRule.$inferSelect,
) {
  const dataSource = rule.dataSource as Record<string, unknown>;
  const checkType = dataSource?.check_type as string;
  // Built-in rule implementations would go here
  // For now, return empty (pass)
  return [];
}

// #S04-01 (ARCTOS-FULL-2026-08-31, Critical) — arbitrary SQL execution as
// DB superuser.
//
// The old implementation was:
//
//   const rows = await db.execute(
//     sql.raw(`SET LOCAL statement_timeout = '60s'; ${query}`),
//   );
//
// `query` came verbatim from `continuous_audit_rule.data_source->>'query'`.
// Three compounding defects:
//
//   1. String concatenation with a leading `SET` made the payload a
//      MULTI-STATEMENT batch by construction. Anything after a `;` ran too
//      (empirically proven: evidence/S04/pg-multistatement-proof.txt).
//   2. The only gate was a keyword blocklist applied at rule-CREATION time
//      (`isReadOnlySql`), bypassed by `SELECT … INTO`, `DO $$…$$`,
//      `COPY … FROM PROGRAM` (RCE), `GRANT`, and plain `;`-chaining
//      (evidence/S04/isreadonlysql-bypass.txt). Rows written by seeds,
//      migrations or any future import path skipped the gate entirely.
//   3. The worker connects as the superuser `grc` (BYPASSRLS) by design
//      (docker-compose.production.yml) — so the query ran with no tenant
//      boundary, could rewrite the audit trail, and could execute shell
//      commands via COPY FROM PROGRAM.
//
// The fix mirrors the already-hardened sister endpoint
// `apps/web/src/app/api/v1/bi-reports/queries/execute/route.ts` and adds
// runtime re-validation:
//
//   a) `validateCustomAuditSql` (allowlist: single SELECT, no `;`, no
//      comments, no dollar-quoting, no DDL/DCL keywords, no file/program/
//      sleep functions) runs HERE, at execution time, not just at creation.
//   b) The statement runs inside ONE transaction that first issues
//      `SET LOCAL ROLE grc_app` — demoting the superuser session to the
//      non-privileged runtime role, so RLS applies and COPY FROM PROGRAM /
//      GRANT are refused by Postgres itself even if (a) were bypassed.
//   c) `SET LOCAL app.current_org_id` scopes the query to the rule's own
//      tenant, so a custom rule can no longer read other orgs' rows.
//   d) `SET TRANSACTION READ ONLY` blocks every write at the engine level.
//   e) `statement_timeout` is a SEPARATE statement, never concatenated.
//   f) A hard `LIMIT` caps the result set.
//
// Fail-closed: if `grc_app` does not exist the transaction throws, the rule
// is recorded as `error` by the caller, and the query is NEVER executed
// unguarded. Any validation failure is likewise surfaced as an error result
// instead of being silently swallowed (the old `catch { return []; }` made a
// rejected payload look like a passing rule).
const CUSTOM_SQL_EXEC_ROLE = "grc_app";
const CUSTOM_SQL_STATEMENT_TIMEOUT = "30s";
const CUSTOM_SQL_MAX_ROWS = 1000;

async function executeCustomSqlRule(
  rule: typeof continuousAuditRule.$inferSelect,
) {
  const dataSource = rule.dataSource as Record<string, unknown>;
  const rawQuery = dataSource?.query;
  if (rawQuery === undefined || rawQuery === null || rawQuery === "") return [];

  const validation = validateCustomAuditSql(rawQuery);
  if (!validation.ok || !validation.sql) {
    // Do NOT execute, and do NOT pretend the rule passed. Throwing puts the
    // rule into the `error` bucket with a persisted errorMessage, which is
    // what an operator needs to see.
    throw new Error(
      `Rule ${rule.id}: custom SQL rejected by validator — ${validation.reason ?? "invalid"}`,
    );
  }
  const safeSql = validation.sql;

  const rows = await db.transaction(async (tx) => {
    // (b) Demote FIRST. `SET LOCAL ROLE` works whether the worker
    // authenticated as the superuser `grc` (a superuser may assume any
    // role) or already as `grc_app`. The role name is a fixed internal
    // constant, never user input.
    await tx.execute(sql.raw(`SET LOCAL ROLE ${CUSTOM_SQL_EXEC_ROLE}`));
    // (c) Tenant scope for the RLS policies, set after the demotion so it
    // is the grc_app session that carries it.
    await tx.execute(
      sql`SELECT set_config('app.current_org_id', ${rule.orgId}, true)`,
    );
    // (e) Timeout as its own statement — no concatenation with user input.
    await tx.execute(
      sql.raw(
        `SET LOCAL statement_timeout = '${CUSTOM_SQL_STATEMENT_TIMEOUT}'`,
      ),
    );
    // (d) Engine-level write ban.
    await tx.execute(sql`SET TRANSACTION READ ONLY`);
    // (f) The validated single SELECT, bounded.
    return tx.execute(
      sql`SELECT * FROM (${sql.raw(safeSql)}) AS custom_audit_rule LIMIT ${CUSTOM_SQL_MAX_ROWS}`,
    );
  });

  return (rows as unknown as Record<string, unknown>[]).map((r) => ({
    description: JSON.stringify(r),
    detail: r,
  }));
}
