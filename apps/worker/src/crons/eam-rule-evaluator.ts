// Sprint 36: EAM Rule Evaluator Worker
// Runs daily — evaluates architecture rules and generates/resolves violations

import { db, architectureRule, architectureRuleViolation, architectureElement, applicationPortfolio } from "@grc/db";
import { eq, and, sql } from "drizzle-orm";

export async function processEamRuleEvaluator(): Promise<{
  rulesEvaluated: number;
  newViolations: number;
  resolvedViolations: number;
}> {
  console.log("[eam-rule-evaluator] Starting daily rule evaluation");

  let newViolations = 0;
  let resolvedViolations = 0;

  // Get all active rules across all orgs
  const rules = await db
    .select()
    .from(architectureRule)
    .where(eq(architectureRule.isActive, true));

  for (const rule of rules) {
    try {
      const condition = rule.condition as Record<string, unknown>;
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
        violatingElementIds = (results as unknown as { id: string }[]).map((r) => r.id);
      } else if (ruleType === "classification") {
        // Check for missing data classification
        const results = await db.execute(sql`
          SELECT ae.id FROM architecture_element ae
          JOIN application_portfolio ap ON ap.element_id = ae.id
          WHERE ae.org_id = ${rule.orgId}
            AND ae.criticality = 'critical'
            AND ap.data_classification IS NULL
        `);
        violatingElementIds = (results as unknown as { id: string }[]).map((r) => r.id);
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

      // Resolve violations that no longer apply
      const resolved = await db.execute(sql`
        UPDATE architecture_rule_violation
        SET status = 'resolved', resolved_at = NOW()
        WHERE rule_id = ${rule.id}
          AND status = 'open'
          AND element_id NOT IN (${violatingElementIds.length > 0 ? sql.join(violatingElementIds.map((id) => sql`${id}`), sql`,`) : sql`NULL`})
      `);

      // Update last evaluated
      await db
        .update(architectureRule)
        .set({ lastEvaluatedAt: new Date() })
        .where(eq(architectureRule.id, rule.id));
    } catch (err) {
      console.error(`[eam-rule-evaluator] Rule ${rule.name} failed:`, err);
    }
  }

  console.log(`[eam-rule-evaluator] Evaluated ${rules.length} rules: ${newViolations} new, ${resolvedViolations} resolved`);
  return { rulesEvaluated: rules.length, newViolations, resolvedViolations };
}
