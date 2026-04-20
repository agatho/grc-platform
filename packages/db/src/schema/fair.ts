// Sprint 25: FAIR (Factor Analysis of Information Risk) — Monte Carlo Cyber Risk Quantification
// 2 entities: fair_parameters, fair_simulation_result
// Enhancement on ERM (Sprint 2)

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  numeric,
  timestamp,
  jsonb,
  index,
  unique,
  pgEnum,
} from "drizzle-orm/pg-core";
import { organization, user } from "./platform";
import { risk } from "./risk";

// ──────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────

export const riskMethodologyEnum = pgEnum("risk_methodology", [
  "qualitative",
  "fair",
  "hybrid",
]);

export const fairSimulationStatusEnum = pgEnum("fair_simulation_status", [
  "pending",
  "running",
  "completed",
  "failed",
]);

// ──────────────────────────────────────────────────────────────
// 25.1 FAIRParameters — PERT inputs per risk
// ──────────────────────────────────────────────────────────────

export const fairParameters = pgTable(
  "fair_parameters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    riskId: uuid("risk_id")
      .notNull()
      .references(() => risk.id, { onDelete: "cascade" })
      .unique(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    // Loss Event Frequency (per year) — PERT distribution inputs
    lefMin: numeric("lef_min", { precision: 10, scale: 4 }).notNull(),
    lefMostLikely: numeric("lef_most_likely", {
      precision: 10,
      scale: 4,
    }).notNull(),
    lefMax: numeric("lef_max", { precision: 10, scale: 4 }).notNull(),
    // Loss Magnitude (EUR) — PERT distribution inputs
    lmMin: numeric("lm_min", { precision: 15, scale: 2 }).notNull(),
    lmMostLikely: numeric("lm_most_likely", {
      precision: 15,
      scale: 2,
    }).notNull(),
    lmMax: numeric("lm_max", { precision: 15, scale: 2 }).notNull(),
    // Loss component breakdown (percentages summing to 100)
    // { productivity: 40, response: 20, replacement: 10, fines: 15, judgments: 0, reputation: 15 }
    lossComponents: jsonb("loss_components").default("{}"),
    // Cross-cutting fields
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by").references(() => user.id),
    updatedBy: uuid("updated_by").references(() => user.id),
  },
  (table) => [
    index("fair_params_org_idx").on(table.orgId),
    index("fair_params_risk_idx").on(table.riskId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 25.2 FAIRSimulationResult — Monte Carlo output
// ──────────────────────────────────────────────────────────────

export const fairSimulationResult = pgTable(
  "fair_simulation_result",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    riskId: uuid("risk_id")
      .notNull()
      .references(() => risk.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    parametersId: uuid("parameters_id").references(() => fairParameters.id),
    // Simulation config
    iterations: integer("iterations").notNull().default(10000),
    status: fairSimulationStatusEnum("status").notNull().default("pending"),
    // ALE percentiles (EUR)
    aleP5: numeric("ale_p5", { precision: 15, scale: 2 }),
    aleP25: numeric("ale_p25", { precision: 15, scale: 2 }),
    aleP50: numeric("ale_p50", { precision: 15, scale: 2 }),
    aleP75: numeric("ale_p75", { precision: 15, scale: 2 }),
    aleP95: numeric("ale_p95", { precision: 15, scale: 2 }),
    aleMean: numeric("ale_mean", { precision: 15, scale: 2 }),
    aleStdDev: numeric("ale_std_dev", { precision: 15, scale: 2 }),
    // Chart data
    histogram: jsonb("histogram"), // [{bucket: 0, count: 120}, ...]
    lossExceedance: jsonb("loss_exceedance"), // [{threshold: 100000, probability: 0.85}, ...]
    // Sensitivity data for tornado diagram
    sensitivity: jsonb("sensitivity"), // [{parameter: 'lef', impact: 0.65}, {parameter: 'lm', impact: 0.35}]
    // Error info (if failed)
    errorMessage: text("error_message"),
    // Timestamps
    computedAt: timestamp("computed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by").references(() => user.id),
  },
  (table) => [
    index("fsr_risk_idx").on(table.riskId),
    index("fsr_org_idx").on(table.orgId),
    index("fsr_computed_idx").on(table.riskId, table.computedAt),
    index("fsr_org_ale_idx").on(table.orgId, table.aleP50),
  ],
);
