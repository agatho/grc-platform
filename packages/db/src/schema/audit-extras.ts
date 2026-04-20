// Audit Extras (ADR-014 Phase 3)
//
// Ergaenzt audit-mgmt.ts + audit-advanced.ts um Sampling, Board-Reporting
// und Exception-Tracking. Migration: 0079_round2_features.sql,
// 0084_round7_financial_reporting.sql.

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  date,
  jsonb,
} from "drizzle-orm/pg-core";
import { organization, user } from "./platform";
import { audit } from "./audit-mgmt";
import { control, controlTestCampaign } from "./control";

export const auditSample = pgTable("audit_sample", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organization.id),
  controlId: uuid("control_id").references(() => control.id),
  auditId: uuid("audit_id").references(() => audit.id),
  campaignId: uuid("campaign_id").references(() => controlTestCampaign.id),
  // random | stratified | judgmental | systematic
  sampleMethod: varchar("sample_method", { length: 30 })
    .default("random")
    .notNull(),
  populationSize: integer("population_size").notNull(),
  sampleSize: integer("sample_size").notNull(),
  // Array<{ id: string; ref: string; metadata?: Record<string, unknown> }>
  sampleItems: jsonb("sample_items").default([]).notNull(),
  results: jsonb("results").default({}),
  exceptionsFound: integer("exceptions_found").default(0),
  // planned | sampled | reviewed | closed
  status: varchar("status", { length: 20 }).default("planned").notNull(),
  sampledAt: timestamp("sampled_at", { withTimezone: true }),
  sampledBy: uuid("sampled_by").references(() => user.id),
  reviewedBy: uuid("reviewed_by").references(() => user.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdBy: uuid("created_by").references(() => user.id),
});

export const boardReport = pgTable("board_report", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organization.id),
  title: varchar("title", { length: 500 }).notNull(),
  // quarterly | annual | ad_hoc | event_driven
  reportType: varchar("report_type", { length: 30 })
    .default("quarterly")
    .notNull(),
  reportingPeriod: varchar("reporting_period", { length: 10 }),
  // Array<{ title: string; content: string; charts?: Array<...> }>
  sections: jsonb("sections").default([]).notNull(),
  // { kpis: {...}, risks: {...}, incidents: {...} }
  dataSnapshots: jsonb("data_snapshots").default({}),
  // draft | in_review | approved | presented
  status: varchar("status", { length: 20 }).default("draft").notNull(),
  presentedAt: date("presented_at"),
  presentedTo: varchar("presented_to", { length: 255 }),
  approvedBy: uuid("approved_by").references(() => user.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdBy: uuid("created_by").references(() => user.id),
});

export const exceptionReport = pgTable("exception_report", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organization.id),
  entityType: varchar("entity_type", { length: 50 }).notNull(),
  entityId: uuid("entity_id").notNull(),
  exceptionType: varchar("exception_type", { length: 50 }).notNull(),
  // low | medium | high | critical
  severity: varchar("severity", { length: 20 }).default("medium").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  // manual | automated | reconciliation | sampling
  detectedMethod: varchar("detected_method", { length: 30 })
    .default("manual")
    .notNull(),
  expectedValue: text("expected_value"),
  actualValue: text("actual_value"),
  isResolved: boolean("is_resolved").default(false).notNull(),
  resolvedBy: uuid("resolved_by").references(() => user.id),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolutionNote: text("resolution_note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdBy: uuid("created_by").references(() => user.id),
});
