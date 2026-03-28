// Sprint 31: Regulatory Simulator + Attack Path Visualization Schema (Drizzle ORM)
// 2 entities: regulation_simulation, attack_path_result

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  decimal,
  index,
} from "drizzle-orm/pg-core";
import { organization, user } from "./platform";
import { asset } from "./asset";

// ──────────────────────────────────────────────────────────────
// 31.1 RegulationSimulation — Saved simulation results
//      Read-only projections of regulatory changes
// ──────────────────────────────────────────────────────────────

export const regulationSimulation = pgTable(
  "regulation_simulation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    regulationName: varchar("regulation_name", { length: 200 }).notNull(),
    scenarioType: varchar("scenario_type", { length: 30 }).notNull(), // add_requirement|tighten|shorten_deadline|add_reporting
    parametersJson: jsonb("parameters_json").notNull(),
    beforeScore: decimal("before_score", { precision: 5, scale: 2 }).notNull(),
    afterScore: decimal("after_score", { precision: 5, scale: 2 }).notNull(),
    gapCount: integer("gap_count").notNull(),
    gapsJson: jsonb("gaps_json").notNull(), // [{ requirement, missingControl, effort, estimatedCost }]
    estimatedTotalCost: decimal("estimated_total_cost", {
      precision: 12,
      scale: 2,
    }),
    timelineJson: jsonb("timeline_json"), // [{ milestone, deadline, status }]
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("rs_org_idx").on(table.orgId),
    scenarioIdx: index("rs_scenario_idx").on(table.orgId, table.scenarioType),
  }),
);

// ──────────────────────────────────────────────────────────────
// 31.2 AttackPathResult — Computed attack paths from BFS
//      Cached results from entry points to crown jewels
// ──────────────────────────────────────────────────────────────

export const attackPathResult = pgTable(
  "attack_path_result",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    entryAssetId: uuid("entry_asset_id")
      .notNull()
      .references(() => asset.id),
    targetAssetId: uuid("target_asset_id")
      .notNull()
      .references(() => asset.id),
    pathJson: jsonb("path_json").notNull(), // [{ assetId, assetName, cveIds, controlGaps, hopProbability }]
    hopCount: integer("hop_count").notNull(),
    riskScore: decimal("risk_score", { precision: 5, scale: 2 }).notNull(),
    blockingControlsJson: jsonb("blocking_controls_json"), // [{ controlId, wouldEliminatePaths }]
    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    batchId: uuid("batch_id").notNull(),
  },
  (table) => ({
    orgIdx: index("apr_org_idx").on(table.orgId),
    batchIdx: index("apr_batch_idx").on(table.orgId, table.batchId),
    entryIdx: index("apr_entry_idx").on(table.orgId, table.entryAssetId),
    targetIdx: index("apr_target_idx").on(table.orgId, table.targetAssetId),
  }),
);
