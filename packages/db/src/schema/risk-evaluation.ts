// Sprint 54: ERM UX & Evaluation Enhancements Schema (Drizzle ORM)
// New tables: risk_evaluation_log, risk_treatment_link
// Extensions to risk table via ALTER columns

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  smallint,
  numeric,
  timestamp,
  date,
  jsonb,
  pgEnum,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { organization, user } from "./platform";
import { risk, riskTreatment } from "./risk";

// ──────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────

export const riskObjectTypeEnum = pgEnum("risk_object_type", [
  "risk",
  "mixed_case",
  "chance",
]);

export const evaluationPhaseEnum = pgEnum("evaluation_phase", [
  "assignment",
  "gross_evaluation",
  "net_evaluation",
  "approval",
  "active",
]);

export const evaluationCycleEnum = pgEnum("evaluation_cycle", [
  "monthly",
  "quarterly",
  "semi_annual",
  "annual",
]);

export const evaluationTypeEnum = pgEnum("evaluation_type", [
  "qualitative",
  "quantitative",
]);

// ──────────────────────────────────────────────────────────────
// risk_evaluation_log — Phase transition audit trail
// ──────────────────────────────────────────────────────────────

export const riskEvaluationLog = pgTable(
  "risk_evaluation_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    riskId: uuid("risk_id")
      .notNull()
      .references(() => risk.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    oldPhase: varchar("old_phase", { length: 20 }),
    newPhase: varchar("new_phase", { length: 20 }).notNull(),
    transitionedBy: uuid("transitioned_by").references(() => user.id),
    justification: text("justification"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("rel_risk_idx").on(table.riskId),
    index("reval_org_idx").on(table.orgId),
  ],
);

// ──────────────────────────────────────────────────────────────
// risk_treatment_link — Cross-cutting measures (many-to-many)
// ──────────────────────────────────────────────────────────────

export const riskTreatmentLink = pgTable(
  "risk_treatment_link",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    riskId: uuid("risk_id")
      .notNull()
      .references(() => risk.id, { onDelete: "cascade" }),
    treatmentId: uuid("treatment_id")
      .notNull()
      .references(() => riskTreatment.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    linkedAt: timestamp("linked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    linkedBy: uuid("linked_by").references(() => user.id),
  },
  (table) => [
    unique("rtl_risk_treatment_uniq").on(table.riskId, table.treatmentId),
    index("rtl_risk_idx").on(table.riskId),
    index("rtl_treatment_idx").on(table.treatmentId),
    index("rtl_org_idx").on(table.orgId),
  ],
);
