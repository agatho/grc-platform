// Sprint 36: EAM Rule Evaluator Worker
// Runs daily — evaluates architecture rules and generates/resolves violations

import { db, architectureRule, architectureRuleViolation } from "@grc/db";
import { eq, and, sql } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";
import { reportJobError } from "../lib/job-runtime";

export const processEamRuleEvaluator = withCronInstrumentation(
  "eam-rule-evaluator",
  async (): Promise<{
    rulesEvaluated: number;
    newViolations: number;
    resolvedViolations: number;
  }> => {
    let newViolations = 0;
    const resolvedViolations = 0;

    // Get all active rules across all orgs
    const rules = await db
      .select()
      .from(architectureRule)
      .where(eq(architectureRule.isActive, true));

    for (const rule of rules) {
      try {
        // ── [N-2 · Welle 6a] BEFUND: `rule.condition` wird nicht gelesen ──
        //
        // Hier stand `const condition = rule.condition as Record<…>` — und
        // keine Zeile darunter hat die Variable angefasst. Ausgewertet wird
        // ausschliesslich `rule.ruleType`, mit fest verdrahtetem SQL je Typ.
        //
        // Die Spalte `architecture_rule.condition` ist damit eine
        // Einstellung ohne Wirkung: zwei Regeln desselben Typs mit
        // verschiedenen Bedingungen liefern dieselben Verstoesse. Dieselbe
        // Form wie `automation_rule.cooldown_minutes` (siehe
        // `packages/automation/src/rule-engine.ts`) — nur laesst sie sich
        // hier nicht in einer Zeile beheben: es gibt keinen Auswerter fuer
        // diese Bedingungen, das SQL je Typ ist die ganze Umsetzung. Das
        // ist ein Feature, kein Aufraeumen, und steht deshalb als Befund in
        // `docs/UMSETZUNG-WELLE-6A.md` §5 statt hier halb gebaut.
        const ruleType = rule.ruleType;

        // Evaluate based on rule type
        let violatingElementIds: string[] = [];

        if (ruleType === "lifecycle") {
          // Check for applications past EOL still active
          const results = await db.execute(sql`
          SELECT ae.id FROM architecture_element ae
          JOIN application_portfolio ap ON ap.element_id = ae.id
          WHERE ae.org_id = ${rule.orgId}
            AND ap.lifecycle_status IN ('end_of_life', 'retired')
            AND ae.status = 'active'
        `);
          violatingElementIds = (results as unknown as { id: string }[]).map(
            (r) => r.id,
          );
        } else if (ruleType === "classification") {
          // Check for missing data classification
          const results = await db.execute(sql`
          SELECT ae.id FROM architecture_element ae
          JOIN application_portfolio ap ON ap.element_id = ae.id
          WHERE ae.org_id = ${rule.orgId}
            AND ae.criticality = 'critical'
            AND ap.data_classification IS NULL
        `);
          violatingElementIds = (results as unknown as { id: string }[]).map(
            (r) => r.id,
          );
        }

        // Create new violations
        for (const elementId of violatingElementIds) {
          const [existing] = await db
            .select({ id: architectureRuleViolation.id })
            .from(architectureRuleViolation)
            .where(
              and(
                eq(architectureRuleViolation.ruleId, rule.id),
                eq(architectureRuleViolation.elementId, elementId),
                eq(architectureRuleViolation.status, "open"),
              ),
            );

          if (!existing) {
            await db.insert(architectureRuleViolation).values({
              ruleId: rule.id,
              elementId,
              orgId: rule.orgId,
              violationDetail: `Rule '${rule.name}' violated`,
            });
            newViolations++;
          }
        }

        // Resolve violations that no longer apply.
        // [N-2] Rueckgabe wird nicht gebraucht — es ist ein UPDATE.
        await db.execute(sql`
        UPDATE architecture_rule_violation
        SET status = 'resolved', resolved_at = NOW()
        WHERE rule_id = ${rule.id}
          AND status = 'open'
          AND element_id NOT IN (${
            violatingElementIds.length > 0
              ? sql.join(
                  violatingElementIds.map((id) => sql`${id}`),
                  sql`,`,
                )
              : sql`NULL`
          })
      `);

        // Update last evaluated
        await db
          .update(architectureRule)
          .set({ lastEvaluatedAt: new Date() })
          .where(eq(architectureRule.id, rule.id));
      } catch (err) {
        // [WP9 · S10-11] was a silent catch — see lib/job-runtime.ts
        reportJobError(
          { job: "eam-rule-evaluator", scope: "Update last evaluated" },
          err,
        );
      }
    }

    return { rulesEvaluated: rules.length, newViolations, resolvedViolations };
  },
);
