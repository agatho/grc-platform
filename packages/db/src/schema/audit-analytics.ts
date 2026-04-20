// Sprint 33: Audit Data Analytics + Predictive Risk Intelligence Schema (Drizzle ORM)
// 6 entities: audit_analytics_import, audit_analytics_result, audit_analytics_template,
//             risk_prediction, risk_prediction_model, risk_prediction_alert

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
import { riskPrediction } from "./predictive-risk";

// ──────────────────────────────────────────────────────────────
// 33.1 AuditAnalyticsImport — Imported ERP/accounting data
//      Transient: auto-deleted after 90 days via expiresAt
// ──────────────────────────────────────────────────────────────

export const auditAnalyticsImport = pgTable(
  "audit_analytics_import",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    auditId: uuid("audit_id"), // optional link to audit
    name: varchar("name", { length: 500 }).notNull(),
    fileName: varchar("file_name", { length: 500 }).notNull(),
    schemaJson: jsonb("schema_json").notNull(), // [{ columnName, dataType, sampleValues }]
    rowCount: integer("row_count").notNull(),
    dataJson: jsonb("data_json").notNull(), // array of row objects, max 50,000 rows
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }), // auto-cleanup after 90 days
  },
  (table) => ({
    orgIdx: index("aai_org_idx").on(table.orgId),
    auditIdx: index("aai_audit_idx").on(table.orgId, table.auditId),
  }),
);

// ──────────────────────────────────────────────────────────────
// 33.2 AuditAnalyticsResult — Analysis results (Benford, duplicates, etc.)
// ──────────────────────────────────────────────────────────────

export const auditAnalyticsResult = pgTable(
  "audit_analytics_result",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    importId: uuid("import_id")
      .notNull()
      .references(() => auditAnalyticsImport.id),
    analysisType: varchar("analysis_type", { length: 30 }).notNull(), // benford|duplicate|three_way_match|outlier|sample
    configJson: jsonb("config_json").notNull(), // analysis parameters
    resultJson: jsonb("result_json").notNull(), // analysis output
    summaryJson: jsonb("summary_json").notNull(), // { flaggedCount, totalAnalyzed, significance }
    findingId: uuid("finding_id"), // linked finding if created
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgImportIdx: index("aar_org_import_idx").on(table.orgId, table.importId),
  }),
);

// ──────────────────────────────────────────────────────────────
// 33.3 AuditAnalyticsTemplate — Reusable analysis configurations
// ──────────────────────────────────────────────────────────────

export const auditAnalyticsTemplate = pgTable(
  "audit_analytics_template",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").references(() => organization.id), // null = platform default
    name: varchar("name", { length: 500 }).notNull(),
    analysisType: varchar("analysis_type", { length: 30 }).notNull(),
    configJson: jsonb("config_json").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("aat_org_idx").on(table.orgId),
  }),
);

// ──────────────────────────────────────────────────────────────
// 33.4 RiskPrediction — ML predictions per risk
// ──────────────────────────────────────────────────────────────

export const auditRiskPrediction = pgTable(
  "audit_risk_prediction",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    riskId: uuid("risk_id").notNull(),
    predictionHorizonDays: integer("prediction_horizon_days")
      .notNull()
      .default(90),
    escalationProbability: decimal("escalation_probability", {
      precision: 5,
      scale: 2,
    }).notNull(), // 0-100%
    predictedScore: decimal("predicted_score", { precision: 5, scale: 2 }),
    featuresJson: jsonb("features_json").notNull(), // { score_trend, kri_momentum, incident_frequency, finding_backlog, control_effectiveness, days_since_review }
    topFactorsJson: jsonb("top_factors_json").notNull(), // [{ factor, description, weight }]
    modelVersion: varchar("model_version", { length: 50 }).notNull(),
    confidence: decimal("confidence", { precision: 5, scale: 2 }),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgRiskIdx: index("arp_org_risk_idx").on(table.orgId, table.riskId),
    probIdx: index("arp_prob_idx").on(table.orgId, table.escalationProbability),
  }),
);

// ──────────────────────────────────────────────────────────────
// 33.5 RiskPredictionModel — Model metadata and training metrics
// ──────────────────────────────────────────────────────────────

export const auditRiskPredictionModel = pgTable(
  "audit_risk_prediction_model",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    version: varchar("version", { length: 50 }).notNull(),
    algorithm: varchar("algorithm", { length: 30 })
      .notNull()
      .default("linear_regression"),
    featureImportanceJson: jsonb("feature_importance_json").notNull(),
    trainingMetrics: jsonb("training_metrics").notNull(), // { mae, rmse, r2, sampleSize }
    trainedAt: timestamp("trained_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("arpm_org_idx").on(table.orgId),
  }),
);

// ──────────────────────────────────────────────────────────────
// 33.6 RiskPredictionAlert — Alerts on high escalation probability
// ──────────────────────────────────────────────────────────────

export const riskPredictionAlert = pgTable(
  "risk_prediction_alert",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    riskId: uuid("risk_id").notNull(),
    predictionId: uuid("prediction_id")
      .notNull()
      .references(() => riskPrediction.id),
    probability: decimal("probability", { precision: 5, scale: 2 }).notNull(),
    notified: boolean("notified").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("rpa_org_idx").on(table.orgId),
    riskIdx: index("rpa_risk_idx").on(table.orgId, table.riskId),
  }),
);
