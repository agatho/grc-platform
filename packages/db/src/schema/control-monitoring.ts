// Control Monitoring (ADR-014 Phase 3)
//
// Regel-Engine fuer automatisierte Control-Effectiveness-Checks.
// Migration: 0081 / 0082 (round4/5 features)
//
// Beispiel-Regeln:
// - "MFA-Abdeckung > 98 %" (threshold)
// - "30+ Tage ohne Patching" (time_since)
// - "Login-Anomalien per Tag" (anomaly)

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { organization, user } from "./platform";
import { control } from "./control";

export const controlMonitoringRule = pgTable("control_monitoring_rule", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organization.id),
  controlId: uuid("control_id").references(() => control.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  // threshold | time_since | anomaly | trend | ratio
  ruleType: varchar("rule_type", { length: 30 }).default("threshold").notNull(),
  configuration: jsonb("configuration").default({}).notNull(),
  // hourly | daily | weekly | monthly
  checkFrequency: varchar("check_frequency", { length: 20 })
    .default("daily")
    .notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  // ok | warning | critical | error
  lastResult: varchar("last_result", { length: 20 }),
  consecutiveFailures: integer("consecutive_failures").default(0),
  alertThreshold: integer("alert_threshold").default(3),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdBy: uuid("created_by").references(() => user.id),
});

export const controlMonitoringResult = pgTable("control_monitoring_result", {
  id: uuid("id").primaryKey().defaultRandom(),
  ruleId: uuid("rule_id")
    .notNull()
    .references(() => controlMonitoringRule.id, { onDelete: "cascade" }),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organization.id),
  // ok | warning | critical | error
  result: varchar("result", { length: 20 }).notNull(),
  details: jsonb("details").default({}),
  checkedAt: timestamp("checked_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
