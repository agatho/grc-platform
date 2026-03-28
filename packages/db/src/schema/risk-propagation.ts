// Sprint 32: Risk Propagation + Incident Correlation Schema (Drizzle ORM)
// 3 entities: org_entity_relationship, risk_propagation_result, incident_correlation

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  jsonb,
  decimal,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organization } from "./platform";

// ──────────────────────────────────────────────────────────────
// 32.1 OrgEntityRelationship — Propagation edges between org entities
//      Defines how risks can cascade across corporate structures
// ──────────────────────────────────────────────────────────────

export const orgEntityRelationship = pgTable(
  "org_entity_relationship",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceOrgId: uuid("source_org_id")
      .notNull()
      .references(() => organization.id),
    targetOrgId: uuid("target_org_id")
      .notNull()
      .references(() => organization.id),
    relationshipType: varchar("relationship_type", { length: 30 }).notNull(), // shared_it|shared_vendor|shared_process|financial_dependency|data_flow
    strength: integer("strength").notNull().default(50), // 0-100 coupling strength
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    uniqueRel: uniqueIndex("oer_unique_idx").on(
      table.sourceOrgId,
      table.targetOrgId,
      table.relationshipType,
    ),
    sourceIdx: index("oer_source_idx").on(table.sourceOrgId),
    targetIdx: index("oer_target_idx").on(table.targetOrgId),
  }),
);

// ──────────────────────────────────────────────────────────────
// 32.2 RiskPropagationResult — Cached propagation computation results
//      BFS traversal results with decay-attenuated probabilities
// ──────────────────────────────────────────────────────────────

export const riskPropagationResult = pgTable(
  "risk_propagation_result",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    sourceRiskId: uuid("source_risk_id").notNull(),
    batchId: uuid("batch_id").notNull(),
    resultsJson: jsonb("results_json").notNull(), // [{ riskId, orgId, level, propagatedScore, delta, via }]
    totalAffectedEntities: integer("total_affected_entities").notNull(),
    maxDepth: integer("max_depth").notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("rpr_org_idx").on(table.orgId),
    sourceIdx: index("rpr_source_idx").on(table.orgId, table.sourceRiskId),
    batchIdx: index("rpr_batch_idx").on(table.batchId),
  }),
);

// ──────────────────────────────────────────────────────────────
// 32.3 IncidentCorrelation — Detected correlations between incidents
//      Computed by algorithm, not user-defined
// ──────────────────────────────────────────────────────────────

export const incidentCorrelation = pgTable(
  "incident_correlation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    correlationType: varchar("correlation_type", { length: 20 }).notNull(), // temporal|asset|pattern|mitre
    incidentIds: uuid("incident_ids").array().notNull(),
    campaignName: varchar("campaign_name", { length: 500 }),
    confidence: integer("confidence").notNull(), // 0-100
    reasoning: text("reasoning"),
    mitreAttackTechniques: jsonb("mitre_attack_techniques").default("[]"),
    sharedFactorsJson: jsonb("shared_factors_json"), // [{ factor, description }]
    detectedAt: timestamp("detected_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("ic_org_idx").on(table.orgId),
    typeIdx: index("ic_type_idx").on(table.orgId, table.correlationType),
  }),
);
