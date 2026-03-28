// Sprint 48: EAM Dashboards & Extended Assessment
// Tables: application_assessment_history
// ALTERs on: application_portfolio (assessment fields), business_capability (lifecycle fields)

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organization, user } from "./platform";
import { architectureElement, applicationPortfolio, businessCapability } from "./eam";

// ──────────────────────────────────────────────────────────────
// Application Assessment History
// Tracks changes to assessment dimensions (via DB trigger)
// ──────────────────────────────────────────────────────────────

export const applicationAssessmentHistory = pgTable(
  "application_assessment_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    applicationPortfolioId: uuid("application_portfolio_id")
      .notNull()
      .references(() => applicationPortfolio.id, { onDelete: "cascade" }),
    dimension: varchar("dimension", { length: 30 }).notNull(),
    oldValue: varchar("old_value", { length: 50 }),
    newValue: varchar("new_value", { length: 50 }).notNull(),
    changedBy: uuid("changed_by").references(() => user.id),
    changedAt: timestamp("changed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    justification: text("justification"),
  },
  (table) => ({
    appIdx: index("aah_app_idx").on(table.applicationPortfolioId),
    dimIdx: index("aah_dim_idx").on(
      table.applicationPortfolioId,
      table.dimension,
    ),
    orgIdx: index("aah_org_idx").on(table.orgId),
  }),
);

export const applicationAssessmentHistoryRelations = relations(
  applicationAssessmentHistory,
  ({ one }) => ({
    organization: one(organization, {
      fields: [applicationAssessmentHistory.orgId],
      references: [organization.id],
    }),
    portfolio: one(applicationPortfolio, {
      fields: [applicationAssessmentHistory.applicationPortfolioId],
      references: [applicationPortfolio.id],
    }),
    changedByUser: one(user, {
      fields: [applicationAssessmentHistory.changedBy],
      references: [user.id],
    }),
  }),
);
