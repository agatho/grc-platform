// Sprint 13: GRC Budget, Cost Tracking & ROI Schema (Drizzle ORM)
// Entities: grc_budget, grc_budget_line, grc_cost_entry, grc_time_entry, grc_roi_calculation

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  numeric,
  integer,
  date,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organization, user } from "./platform";
import { task } from "./task";

// ──────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────

export const budgetStatusEnum = pgEnum("budget_status", [
  "draft",
  "submitted",
  "approved",
]);

export const grcAreaEnum = pgEnum("grc_area", [
  "erm",
  "isms",
  "ics",
  "dpms",
  "audit",
  "tprm",
  "bcms",
  "esg",
  "general",
]);

export const costCategoryEnum = pgEnum("cost_category", [
  "personnel",
  "external",
  "tools",
  "training",
  "measures",
  "certification",
]);

export const costTypeEnum = pgEnum("cost_type", [
  "planned",
  "actual",
  "forecast",
]);

export const roiMethodEnum = pgEnum("roi_method", [
  "ale_reduction",
  "penalty_avoidance",
  "incident_prevention",
  "roni",
]);

// ──────────────────────────────────────────────────────────────
// 13.1 GRC Budget — Yearly budget per organization
// ──────────────────────────────────────────────────────────────

export const grcBudget = pgTable(
  "grc_budget",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    year: integer("year").notNull(),
    totalAmount: numeric("total_amount", { precision: 15, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("EUR"),
    status: budgetStatusEnum("status").notNull().default("draft"),
    approvedBy: uuid("approved_by").references(() => user.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("gb_org_year_idx").on(table.orgId, table.year),
  ],
);

// ──────────────────────────────────────────────────────────────
// 13.2 GRC Budget Line — Per-area, per-category breakdown
// ──────────────────────────────────────────────────────────────

export const grcBudgetLine = pgTable(
  "grc_budget_line",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    budgetId: uuid("budget_id")
      .notNull()
      .references(() => grcBudget.id, { onDelete: "cascade" }),
    grcArea: grcAreaEnum("grc_area").notNull(),
    costCategory: costCategoryEnum("cost_category").notNull(),
    plannedAmount: numeric("planned_amount", {
      precision: 15,
      scale: 2,
    }).notNull(),
    q1Amount: numeric("q1_amount", { precision: 15, scale: 2 }),
    q2Amount: numeric("q2_amount", { precision: 15, scale: 2 }),
    q3Amount: numeric("q3_amount", { precision: 15, scale: 2 }),
    q4Amount: numeric("q4_amount", { precision: 15, scale: 2 }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("gbl_budget_idx").on(table.budgetId),
    index("gbl_org_idx").on(table.orgId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 13.3 GRC Cost Entry — Polymorphic cost tracking
// ──────────────────────────────────────────────────────────────

export const grcCostEntry = pgTable(
  "grc_cost_entry",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    entityType: varchar("entity_type", { length: 50 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    costCategory: costCategoryEnum("cost_category").notNull(),
    costType: costTypeEnum("cost_type").notNull().default("actual"),
    amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("EUR"),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    department: varchar("department", { length: 200 }),
    hours: numeric("hours", { precision: 8, scale: 2 }),
    hourlyRate: numeric("hourly_rate", { precision: 8, scale: 2 }),
    description: text("description"),
    budgetId: uuid("budget_id").references(() => grcBudget.id),
    invoiceRef: varchar("invoice_ref", { length: 200 }),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("gce_org_idx").on(table.orgId),
    index("gce_entity_idx").on(table.entityType, table.entityId),
    index("gce_period_idx").on(table.orgId, table.periodStart),
    index("gce_category_idx").on(table.orgId, table.costCategory),
  ],
);

// ──────────────────────────────────────────────────────────────
// 13.4 GRC Time Entry — Hours tracking per user/task/entity
// ──────────────────────────────────────────────────────────────

export const grcTimeEntry = pgTable(
  "grc_time_entry",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id),
    taskId: uuid("task_id").references(() => task.id),
    entityType: varchar("entity_type", { length: 50 }),
    entityId: uuid("entity_id"),
    grcArea: grcAreaEnum("grc_area").notNull(),
    department: varchar("department", { length: 200 }),
    hours: numeric("hours", { precision: 6, scale: 2 }).notNull(),
    date: date("date").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("gte_org_idx").on(table.orgId),
    index("gte_user_idx").on(table.userId),
    index("gte_date_idx").on(table.orgId, table.date),
  ],
);

// ──────────────────────────────────────────────────────────────
// 13.5 GRC ROI Calculation — Cached ROI/RONI per entity
// ──────────────────────────────────────────────────────────────

export const grcRoiCalculation = pgTable(
  "grc_roi_calculation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    entityType: varchar("entity_type", { length: 50 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    investmentCost: numeric("investment_cost", { precision: 15, scale: 2 }),
    riskReductionValue: numeric("risk_reduction_value", {
      precision: 15,
      scale: 2,
    }),
    roiPercent: numeric("roi_percent", { precision: 10, scale: 2 }),
    roniCfo: numeric("roni_cfo", { precision: 15, scale: 2 }),
    roniCiso: numeric("roni_ciso", { precision: 15, scale: 2 }),
    inherentAle: numeric("inherent_ale", { precision: 15, scale: 2 }),
    residualAle: numeric("residual_ale", { precision: 15, scale: 2 }),
    calculationMethod: roiMethodEnum("calculation_method"),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("groi_org_idx").on(table.orgId),
    index("groi_entity_idx").on(table.entityType, table.entityId),
  ],
);
