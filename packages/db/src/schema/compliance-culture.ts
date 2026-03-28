// Sprint 27: Compliance Culture Index (CCI) Schema (Drizzle ORM)
// 2 entities: complianceCultureSnapshot, cciConfiguration

import {
  pgTable,
  uuid,
  varchar,
  text,
  decimal,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organization } from "./platform";

// ──────────────────────────────────────────────────────────────
// 27.1 ComplianceCultureSnapshot — Monthly CCI score per org/department
// Immutable: once created, never updated. New month = new snapshot.
// ──────────────────────────────────────────────────────────────

export const complianceCultureSnapshot = pgTable(
  "compliance_culture_snapshot",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    orgEntityId: uuid("org_entity_id"), // null = org-wide; FK via migration SQL
    period: varchar("period", { length: 7 }).notNull(), // YYYY-MM
    overallScore: decimal("overall_score", { precision: 5, scale: 2 }).notNull(), // 0–100
    factorScores: jsonb("factor_scores").notNull(), // { task_compliance: 85.2, ... }
    factorWeights: jsonb("factor_weights").notNull(), // { task_compliance: 0.20, ... }
    rawMetrics: jsonb("raw_metrics").notNull(), // { task_compliance: { total: 100, on_time: 85 }, ... }
    trend: varchar("trend", { length: 10 }), // up | down | stable
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("ccs_org_period_entity_idx").on(
      table.orgId,
      table.orgEntityId,
      table.period,
    ),
    index("ccs_org_idx").on(table.orgId),
    index("ccs_period_idx").on(table.orgId, table.period),
  ],
);

// ──────────────────────────────────────────────────────────────
// 27.2 CCIConfiguration — Per-org factor weight configuration
// One row per organization (UNIQUE on org_id)
// ──────────────────────────────────────────────────────────────

export const cciConfiguration = pgTable(
  "cci_configuration",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    factorWeights: jsonb("factor_weights")
      .notNull()
      .default(
        sql`'{"task_compliance":0.20,"policy_ack_rate":0.15,"training_completion":0.15,"incident_response_time":0.20,"audit_finding_closure":0.15,"self_assessment_participation":0.15}'::jsonb`,
      ),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    uniqueIndex("cci_config_org_idx").on(table.orgId),
  ],
);
