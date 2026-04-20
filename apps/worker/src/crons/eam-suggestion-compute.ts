// Sprint 51: EAM Suggestion Compute Worker — Daily
// Rule-based, NO LLM needed — computes suggestions from EOL dates, risk counts, assessment gaps

import { db, applicationPortfolio, architectureElement, eamObjectSuggestion } from "@grc/db";
import { eq, and, sql, lte, isNull, or } from "drizzle-orm";

export async function processEamSuggestionCompute(): Promise<{
  suggestionsCreated: number;
}> {
  console.log("[eam-suggestion-compute] Computing rule-based suggestions");

  // Clear old suggestions (recompute fresh)
  await db.execute(sql`DELETE FROM eam_object_suggestion WHERE computed_at < NOW() - INTERVAL '7 days'`);

  let suggestionsCreated = 0;

  // Rule 1: EOL approaching (within 12 months)
  const eolApproaching = await db.execute(sql`
    SELECT ae.id AS entity_id, ae.owner AS user_id, ae.org_id
    FROM application_portfolio ap
    JOIN architecture_element ae ON ap.element_id = ae.id
    WHERE ap.planned_eol IS NOT NULL
      AND ap.planned_eol <= CURRENT_DATE + INTERVAL '12 months'
      AND ap.planned_eol > CURRENT_DATE
      AND ap.lifecycle_status = 'active'
      AND ae.owner IS NOT NULL
  `);

  for (const row of eolApproaching as unknown as Array<Record<string, string>>) {
    await db.insert(eamObjectSuggestion).values({
      orgId: row.org_id,
      userId: row.user_id,
      entityId: row.entity_id,
      entityType: "application",
      reason: "eol_approaching",
      priority: 8,
    }).onConflictDoNothing();
    suggestionsCreated++;
  }

  // Rule 2: Unassessed applications (no assessment in 12+ months)
  const unassessed = await db.execute(sql`
    SELECT ae.id AS entity_id, ae.owner AS user_id, ae.org_id
    FROM application_portfolio ap
    JOIN architecture_element ae ON ap.element_id = ae.id
    WHERE (ap.last_assessed_at IS NULL OR ap.last_assessed_at < NOW() - INTERVAL '12 months')
      AND ap.lifecycle_status = 'active'
      AND ae.owner IS NOT NULL
  `);

  for (const row of unassessed as unknown as Array<Record<string, string>>) {
    await db.insert(eamObjectSuggestion).values({
      orgId: row.org_id,
      userId: row.user_id,
      entityId: row.entity_id,
      entityType: "application",
      reason: "unassessed",
      priority: 5,
    }).onConflictDoNothing();
    suggestionsCreated++;
  }

  console.log(`[eam-suggestion-compute] Complete: ${suggestionsCreated} suggestions created`);

  return { suggestionsCreated };
}
