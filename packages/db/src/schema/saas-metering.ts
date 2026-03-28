// Sprint 61: Multi-Tenant SaaS und Metering (Drizzle ORM)
// 6 entities: subscription_plan, org_subscription, usage_meter, usage_record, billing_invoice, feature_gate

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  jsonb,
  index,
  uniqueIndex,
  numeric,
} from "drizzle-orm/pg-core";
import { organization, user } from "./platform";

// ──────────────────────────────────────────────────────────────
// 61.1 SubscriptionPlan — Available subscription tiers
// ──────────────────────────────────────────────────────────────

export const subscriptionPlan = pgTable(
  "subscription_plan",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: varchar("key", { length: 50 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    tier: varchar("tier", { length: 30 }).notNull(),
    priceMonthly: integer("price_monthly"),
    priceYearly: integer("price_yearly"),
    currency: varchar("currency", { length: 3 }).notNull().default("EUR"),
    maxUsers: integer("max_users"),
    maxOrganizations: integer("max_organizations"),
    maxStorageGb: integer("max_storage_gb"),
    maxApiCallsPerMonth: integer("max_api_calls_per_month"),
    features: jsonb("features").default("{}"),
    isActive: boolean("is_active").notNull().default(true),
    isPublic: boolean("is_public").notNull().default(true),
    trialDays: integer("trial_days").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("sub_plan_tier_idx").on(table.tier),
    index("sub_plan_active_idx").on(table.isActive),
  ],
);

// ──────────────────────────────────────────────────────────────
// 61.2 OrgSubscription — Per-org subscription state
// ──────────────────────────────────────────────────────────────

export const orgSubscription = pgTable(
  "org_subscription",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    planId: uuid("plan_id")
      .notNull()
      .references(() => subscriptionPlan.id),
    status: varchar("status", { length: 30 }).notNull().default("active"),
    billingCycle: varchar("billing_cycle", { length: 20 }).notNull().default("monthly"),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }).notNull(),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }).notNull(),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),
    externalCustomerId: varchar("external_customer_id", { length: 255 }),
    externalSubscriptionId: varchar("external_subscription_id", { length: 255 }),
    paymentMethod: varchar("payment_method", { length: 50 }),
    metadata: jsonb("metadata").default("{}"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("org_sub_org_idx").on(table.orgId),
    index("org_sub_plan_idx").on(table.planId),
    index("org_sub_status_idx").on(table.orgId, table.status),
    uniqueIndex("org_sub_active_unique_idx").on(table.orgId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 61.3 UsageMeter — Meter definitions for usage tracking
// ──────────────────────────────────────────────────────────────

export const usageMeter = pgTable(
  "usage_meter",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: varchar("key", { length: 100 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    unit: varchar("unit", { length: 50 }).notNull(),
    aggregationType: varchar("aggregation_type", { length: 20 }).notNull().default("sum"),
    resetInterval: varchar("reset_interval", { length: 20 }).notNull().default("monthly"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("usage_meter_active_idx").on(table.isActive),
  ],
);

// ──────────────────────────────────────────────────────────────
// 61.4 UsageRecord — Per-org usage data points
// ──────────────────────────────────────────────────────────────

export const usageRecord = pgTable(
  "usage_record",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    meterId: uuid("meter_id")
      .notNull()
      .references(() => usageMeter.id),
    quantity: numeric("quantity", { precision: 18, scale: 4 }).notNull(),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    metadata: jsonb("metadata").default("{}"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("usage_record_org_idx").on(table.orgId),
    index("usage_record_meter_idx").on(table.meterId),
    index("usage_record_period_idx").on(table.orgId, table.meterId, table.periodStart),
  ],
);

// ──────────────────────────────────────────────────────────────
// 61.5 BillingInvoice — Generated invoices
// ──────────────────────────────────────────────────────────────

export const billingInvoice = pgTable(
  "billing_invoice",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => orgSubscription.id),
    invoiceNumber: varchar("invoice_number", { length: 50 }).notNull().unique(),
    status: varchar("status", { length: 20 }).notNull().default("draft"),
    subtotal: integer("subtotal").notNull(),
    tax: integer("tax").notNull().default(0),
    total: integer("total").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("EUR"),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    lineItems: jsonb("line_items").default("[]"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
    externalInvoiceId: varchar("external_invoice_id", { length: 255 }),
    pdfUrl: varchar("pdf_url", { length: 500 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("billing_inv_org_idx").on(table.orgId),
    index("billing_inv_sub_idx").on(table.subscriptionId),
    index("billing_inv_status_idx").on(table.orgId, table.status),
    index("billing_inv_date_idx").on(table.createdAt),
  ],
);

// ──────────────────────────────────────────────────────────────
// 61.6 FeatureGate — Feature flags per plan
// ──────────────────────────────────────────────────────────────

export const featureGate = pgTable(
  "feature_gate",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: varchar("key", { length: 100 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    module: varchar("module", { length: 50 }),
    gateType: varchar("gate_type", { length: 20 }).notNull().default("boolean"),
    defaultValue: jsonb("default_value").default("false"),
    planOverrides: jsonb("plan_overrides").default("{}"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("feature_gate_key_idx").on(table.key),
    index("feature_gate_module_idx").on(table.module),
    index("feature_gate_active_idx").on(table.isActive),
  ],
);
