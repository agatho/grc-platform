// Sprint 10: ESG/CSRD Module Schema (Drizzle ORM)
// 9 entities: esg_materiality_assessment, esg_materiality_topic, esg_materiality_vote,
// esrs_datapoint_definition, esrs_metric, esg_measurement, esg_target,
// esg_control_link, esg_annual_report

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  date,
  integer,
  numeric,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organization, user } from "./platform";
import { control } from "./control";

// ──────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────

export const materialityStatusEnum = pgEnum("materiality_status", [
  "draft",
  "in_progress",
  "completed",
]);

export const dataQualityEnum = pgEnum("data_quality", [
  "measured",
  "estimated",
  "calculated",
]);

export const targetTypeEnum = pgEnum("target_type", [
  "absolute",
  "intensity",
  "relative",
]);

export const targetStatusEnum = pgEnum("target_status", [
  "on_track",
  "at_risk",
  "off_track",
  "achieved",
]);

export const reportStatusEnum = pgEnum("report_status", [
  "draft",
  "in_review",
  "approved",
  "published",
]);

export const esgFrequencyEnum = pgEnum("esg_frequency", [
  "annual",
  "semi_annual",
  "quarterly",
]);

// ──────────────────────────────────────────────────────────────
// 10.1 EsgMaterialityAssessment — Double materiality per year
// ──────────────────────────────────────────────────────────────

export const esgMaterialityAssessment = pgTable(
  "esg_materiality_assessment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    reportingYear: integer("reporting_year").notNull(),
    status: materialityStatusEnum("status").notNull().default("draft"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("ema_org_year_idx").on(table.orgId, table.reportingYear),
  ],
);

// ──────────────────────────────────────────────────────────────
// 10.2 EsgMaterialityTopic — Individual topics scored
// ──────────────────────────────────────────────────────────────

export const esgMaterialityTopic = pgTable(
  "esg_materiality_topic",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => esgMaterialityAssessment.id, { onDelete: "cascade" }),
    esrsStandard: varchar("esrs_standard", { length: 10 }).notNull(),
    topicName: varchar("topic_name", { length: 200 }).notNull(),
    impactScore: numeric("impact_score", { precision: 4, scale: 2 }),
    financialScore: numeric("financial_score", { precision: 4, scale: 2 }),
    isMaterial: boolean("is_material"),
    justification: text("justification"),
    stakeholderConsensus: numeric("stakeholder_consensus", {
      precision: 5,
      scale: 2,
    }),
  },
  (table) => [index("emt_assessment_idx").on(table.assessmentId)],
);

// ──────────────────────────────────────────────────────────────
// 10.3 EsgMaterialityVote — Stakeholder votes on topics
// ──────────────────────────────────────────────────────────────

export const esgMaterialityVote = pgTable(
  "esg_materiality_vote",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => esgMaterialityTopic.id, { onDelete: "cascade" }),
    voterId: uuid("voter_id").references(() => user.id),
    voterName: varchar("voter_name", { length: 200 }),
    voterType: varchar("voter_type", { length: 50 }).notNull(),
    impactScore: numeric("impact_score", { precision: 4, scale: 2 }).notNull(),
    financialScore: numeric("financial_score", {
      precision: 4,
      scale: 2,
    }).notNull(),
    comment: text("comment"),
    votedAt: timestamp("voted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("emv_topic_idx").on(table.topicId)],
);

// ──────────────────────────────────────────────────────────────
// 10.4 EsrsDatapointDefinition — ESRS catalog (seed data)
// ──────────────────────────────────────────────────────────────

export const esrsDatapointDefinition = pgTable("esrs_datapoint_definition", {
  id: uuid("id").primaryKey().defaultRandom(),
  esrsStandard: varchar("esrs_standard", { length: 10 }).notNull(),
  disclosureRequirement: varchar("disclosure_requirement", {
    length: 20,
  }).notNull(),
  datapointCode: varchar("datapoint_code", { length: 30 }).notNull().unique(),
  nameDe: varchar("name_de", { length: 500 }).notNull(),
  nameEn: varchar("name_en", { length: 500 }).notNull(),
  descriptionDe: text("description_de"),
  descriptionEn: text("description_en"),
  dataType: varchar("data_type", { length: 20 }).notNull(),
  unit: varchar("unit", { length: 50 }),
  isMandatory: boolean("is_mandatory").notNull().default(false),
  frequency: varchar("frequency", { length: 20 }).default("annual"),
  calculationMethod: text("calculation_method"),
  relatedTopics: text("related_topics").array(),
});

// ──────────────────────────────────────────────────────────────
// 10.5 EsrsMetric — Org-specific metric linked to datapoint
// ──────────────────────────────────────────────────────────────

export const esrsMetric = pgTable(
  "esrs_metric",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    datapointId: uuid("datapoint_id")
      .notNull()
      .references(() => esrsDatapointDefinition.id),
    name: varchar("name", { length: 500 }).notNull(),
    unit: varchar("unit", { length: 50 }).notNull(),
    frequency: esgFrequencyEnum("frequency").notNull().default("annual"),
    collectionMethod: varchar("collection_method", { length: 20 }).default(
      "manual",
    ),
    calculationFormula: text("calculation_formula"),
    responsibleUserId: uuid("responsible_user_id").references(() => user.id),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("em_org_idx").on(table.orgId),
    index("em_datapoint_idx").on(table.orgId, table.datapointId),
  ],
);

// ──────────────────────────────────────────────────────────────
// 10.6 EsgMeasurement — Time-series measurement data
// ──────────────────────────────────────────────────────────────

export const esgMeasurement = pgTable(
  "esg_measurement",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    metricId: uuid("metric_id")
      .notNull()
      .references(() => esrsMetric.id),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    value: numeric("value", { precision: 15, scale: 4 }).notNull(),
    unit: varchar("unit", { length: 50 }).notNull(),
    dataQuality: dataQualityEnum("data_quality").notNull().default("estimated"),
    source: varchar("source", { length: 200 }),
    verifiedBy: uuid("verified_by").references(() => user.id),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    notes: text("notes"),
    recordedAt: timestamp("recorded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("emeas_org_metric_idx").on(table.orgId, table.metricId),
    index("emeas_metric_period_idx").on(table.metricId, table.periodStart),
  ],
);

// ──────────────────────────────────────────────────────────────
// 10.7 EsgTarget — Reduction/improvement targets
// ──────────────────────────────────────────────────────────────

export const esgTarget = pgTable(
  "esg_target",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    metricId: uuid("metric_id")
      .notNull()
      .references(() => esrsMetric.id),
    name: varchar("name", { length: 500 }).notNull(),
    baselineYear: integer("baseline_year").notNull(),
    baselineValue: numeric("baseline_value", {
      precision: 20,
      scale: 6,
    }).notNull(),
    targetYear: integer("target_year").notNull(),
    targetValue: numeric("target_value", {
      precision: 20,
      scale: 6,
    }).notNull(),
    targetType: targetTypeEnum("target_type").notNull().default("absolute"),
    sbtiAligned: boolean("sbti_aligned").notNull().default(false),
    status: targetStatusEnum("status").notNull().default("on_track"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("et_org_idx").on(table.orgId)],
);

// ──────────────────────────────────────────────────────────────
// 10.8 EsgControlLink — ESRS datapoint <-> Control mapping
// ──────────────────────────────────────────────────────────────

export const esgControlLink = pgTable(
  "esg_control_link",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    datapointId: uuid("datapoint_id")
      .notNull()
      .references(() => esrsDatapointDefinition.id),
    controlId: uuid("control_id")
      .notNull()
      .references(() => control.id),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("ecl_unique_idx").on(
      table.orgId,
      table.datapointId,
      table.controlId,
    ),
  ],
);

// ──────────────────────────────────────────────────────────────
// 10.9 EsgAnnualReport — CSRD report status tracking
// ──────────────────────────────────────────────────────────────

export const esgAnnualReport = pgTable(
  "esg_annual_report",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    reportingYear: integer("reporting_year").notNull(),
    status: reportStatusEnum("status").notNull().default("draft"),
    completenessPercent: integer("completeness_percent").default(0),
    exportedAt: timestamp("exported_at", { withTimezone: true }),
    approvedBy: uuid("approved_by").references(() => user.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("ear_org_year_idx").on(table.orgId, table.reportingYear),
  ],
);
