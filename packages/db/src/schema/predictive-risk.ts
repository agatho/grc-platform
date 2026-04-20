// Sprint 71: Predictive Risk Intelligence
// Tables: risk_prediction_model, risk_prediction, risk_anomaly_detection

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
  numeric,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organization, user } from "./platform";

// ──────────────────────────────────────────────────────────────
// 71.1 Risk Prediction Model — ML model configurations
// ──────────────────────────────────────────────────────────────

export const riskPredictionModel = pgTable(
  "risk_prediction_model",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    name: varchar("name", { length: 500 }).notNull(),
    description: text("description"),
    modelType: varchar("model_type", { length: 50 }).notNull(), // anomaly_detection | trend_forecast | correlation | score_prediction | early_warning
    algorithm: varchar("algorithm", { length: 50 }).notNull(), // arima | prophet | isolation_forest | random_forest | neural_net | ensemble
    targetMetric: varchar("target_metric", { length: 100 }).notNull(), // risk_score | kri_value | incident_count | control_effectiveness
    inputFeatures: jsonb("input_features").notNull().default("[]"), // [{feature, source, weight}]
    hyperparameters: jsonb("hyperparameters").default("{}"),
    trainingConfig: jsonb("training_config").default("{}"), // {windowDays, minSamples, retrainFrequency}
    accuracy: numeric("accuracy", { precision: 5, scale: 2 }),
    lastTrainedAt: timestamp("last_trained_at", { withTimezone: true }),
    trainingSamples: integer("training_samples").notNull().default(0),
    modelState: jsonb("model_state"), // serialized model weights/params
    status: varchar("status", { length: 20 }).notNull().default("untrained"), // untrained | training | active | degraded | archived
    isActive: boolean("is_active").notNull().default(false),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("rpm_org_idx").on(table.orgId),
    typeIdx: index("rpm_type_idx").on(table.orgId, table.modelType),
    activeIdx: index("rpm_active_idx").on(table.orgId, table.isActive),
    targetIdx: index("rpm_target_idx").on(table.orgId, table.targetMetric),
  }),
);

export const riskPredictionModelRelations = relations(
  riskPredictionModel,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [riskPredictionModel.orgId],
      references: [organization.id],
    }),
    creator: one(user, {
      fields: [riskPredictionModel.createdBy],
      references: [user.id],
    }),
    predictions: many(riskPrediction),
    anomalies: many(riskAnomalyDetection),
  }),
);

// ──────────────────────────────────────────────────────────────
// 71.2 Risk Prediction — Forecast outputs
// ──────────────────────────────────────────────────────────────

export const riskPrediction = pgTable(
  "risk_prediction",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    modelId: uuid("model_id")
      .notNull()
      .references(() => riskPredictionModel.id, { onDelete: "cascade" }),
    orgId: uuid("org_id").notNull(),
    entityType: varchar("entity_type", { length: 50 }).notNull(), // risk | kri | control | process
    entityId: uuid("entity_id").notNull(),
    predictionType: varchar("prediction_type", { length: 50 }).notNull(), // score_forecast | trend | threshold_breach | correlation
    currentValue: numeric("current_value", { precision: 12, scale: 4 }),
    predictedValue: numeric("predicted_value", {
      precision: 12,
      scale: 4,
    }).notNull(),
    confidenceInterval: jsonb("confidence_interval").default("{}"), // {lower, upper, confidence}
    predictionHorizonDays: integer("prediction_horizon_days").notNull(),
    confidence: numeric("confidence", { precision: 5, scale: 2 }).notNull(),
    trendDirection: varchar("trend_direction", { length: 20 }), // increasing | stable | decreasing
    trendStrength: numeric("trend_strength", { precision: 5, scale: 2 }), // 0-100
    riskLevel: varchar("risk_level", { length: 20 }), // critical | high | medium | low
    earlyWarning: boolean("early_warning").notNull().default(false),
    earlyWarningMessage: text("early_warning_message"),
    contributingFactors: jsonb("contributing_factors").default("[]"), // [{factor, weight, direction}]
    correlatedEntities: jsonb("correlated_entities").default("[]"), // [{entityType, entityId, correlation}]
    isActive: boolean("is_active").notNull().default(true),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    modelIdx: index("rp_model_idx").on(table.modelId),
    orgIdx: index("rp_org_idx").on(table.orgId),
    entityIdx: index("rp_entity_idx").on(
      table.orgId,
      table.entityType,
      table.entityId,
    ),
    warningIdx: index("rp_warning_idx").on(table.orgId, table.earlyWarning),
    riskLevelIdx: index("rp_risk_level_idx").on(table.orgId, table.riskLevel),
    activeIdx: index("rp_active_idx").on(table.orgId, table.isActive),
  }),
);

export const riskPredictionRelations = relations(riskPrediction, ({ one }) => ({
  model: one(riskPredictionModel, {
    fields: [riskPrediction.modelId],
    references: [riskPredictionModel.id],
  }),
}));

// ──────────────────────────────────────────────────────────────
// 71.3 Risk Anomaly Detection — Detected anomalies
// ──────────────────────────────────────────────────────────────

export const riskAnomalyDetection = pgTable(
  "risk_anomaly_detection",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    modelId: uuid("model_id").references(() => riskPredictionModel.id),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    entityType: varchar("entity_type", { length: 50 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    anomalyType: varchar("anomaly_type", { length: 50 }).notNull(), // spike | drop | pattern_break | drift | outlier
    severity: varchar("severity", { length: 20 }).notNull(), // critical | high | medium | low
    metricName: varchar("metric_name", { length: 100 }).notNull(),
    expectedValue: numeric("expected_value", { precision: 12, scale: 4 }),
    actualValue: numeric("actual_value", { precision: 12, scale: 4 }).notNull(),
    deviationPercent: numeric("deviation_percent", { precision: 8, scale: 2 }),
    anomalyScore: numeric("anomaly_score", {
      precision: 5,
      scale: 2,
    }).notNull(), // 0-100
    description: text("description").notNull(),
    possibleCauses: jsonb("possible_causes").default("[]"),
    suggestedActions: jsonb("suggested_actions").default("[]"),
    status: varchar("status", { length: 20 }).notNull().default("new"), // new | investigating | resolved | false_positive
    resolvedBy: uuid("resolved_by").references(() => user.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolutionNote: text("resolution_note"),
    detectedAt: timestamp("detected_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("rad_org_idx").on(table.orgId),
    entityIdx: index("rad_entity_idx").on(
      table.orgId,
      table.entityType,
      table.entityId,
    ),
    severityIdx: index("rad_severity_idx").on(table.orgId, table.severity),
    statusIdx: index("rad_status_idx").on(table.orgId, table.status),
    dateIdx: index("rad_date_idx").on(table.orgId, table.detectedAt),
    modelIdx: index("rad_model_idx").on(table.modelId),
  }),
);

export const riskAnomalyDetectionRelations = relations(
  riskAnomalyDetection,
  ({ one }) => ({
    model: one(riskPredictionModel, {
      fields: [riskAnomalyDetection.modelId],
      references: [riskPredictionModel.id],
    }),
    organization: one(organization, {
      fields: [riskAnomalyDetection.orgId],
      references: [organization.id],
    }),
    resolver: one(user, {
      fields: [riskAnomalyDetection.resolvedBy],
      references: [user.id],
    }),
  }),
);
