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
  index,
  unique,
} from "drizzle-orm/pg-core";
import { organization, user } from "./platform";
import { risk, riskTreatment } from "./risk";

// ──────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────
//
// [ARCTOS-FULL-2026-08-31 / Restdefekte · O-6] The four declarations moved to
// the leaf module `risk-evaluation-enums.ts` so that `risk.ts` can declare the
// columns they belong to (risk.risk_object_type / .evaluation_phase /
// .evaluation_cycle / .evaluation_type) without an import cycle. Re-exported
// here, so every existing importer keeps working unchanged.

export {
  riskObjectTypeEnum,
  evaluationPhaseEnum,
  evaluationCycleEnum,
  evaluationTypeEnum,
} from "./risk-evaluation-enums";

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
