/**
 * STUFE2-E — Die Tabellen, die die zehn leeren GRC-Diagramm-Layer scharfschalten.
 *
 * Bedarfsliste: `docs/bpmn-engine/STUFE2-A2-GRC.md` §5.1, Umsetzung und
 * Begruendungen: `docs/bpmn-engine/STUFE2-E-SCHEMA.md`, Migrationen 0444–0452.
 * Jede fachliche Entscheidung steht im Kopfkommentar der jeweiligen Migration;
 * hier steht nur, was Drizzle wissen muss, damit der Schema-Drift-Test in
 * beide Richtungen leer bleibt.
 *
 * | Tabelle                      | Migration | schaltet frei                        |
 * | ---------------------------- | --------- | ------------------------------------ |
 * | `process_lane`               | 0444      | `trust-boundary` (F5), `lane` (F17)  |
 * | `sod_rule`                   | 0446      | `sod` (F3)                           |
 * | `process_step_raci`          | 0447      | `raci.consulted` / `.informed`       |
 * | `process_step_ropa`          | 0448      | `privacy`, `dpia`, `retention` (F10) |
 * | `process_step_data_category` | 0448      | Kategoriechips, Art.-9-Stufe         |
 * | `process_step_recipient`     | 0448      | `GrcRopa.recipients`                 |
 * | `process_step_bia`           | 0449      | `bcm` (§3.10), `outage` (F6)         |
 * | `process_step_document`      | 0450      | `document` (§3.6)                    |
 * | `process_event_activity_map` | 0451      | `conformance` (F7)                   |
 * | `user_diagram_preference`    | 0452      | — (Sichtvoreinstellung, §3.3.4)      |
 *
 * **Fremdschluessel, die hier fehlen und in der Migration stehen.**
 * `process_step_*.process_step_id` traegt in dieser Datei kein
 * `.references()`: `process.ts` importiert nicht aus dieser Datei, wohl aber
 * umgekehrt, und ein Drizzle-Fremdschluessel in beide Richtungen erzeugte
 * einen Zyklus. Dieselbe Loesung wie bei `finding.processStepId` und
 * `processFrameworkMapping.processStepId`. Die Bedingungen selbst stehen in
 * der Datenbank — der RLS- und der Index-Systemtest pruefen sie dort.
 */

import {
  boolean,
  char,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { customRole, organization, user } from "./platform";
import { process } from "./process";
import { eamOrgUnit } from "./eam-data-architecture";
import { vendor } from "./tprm";
import {
  dpia,
  ropaDataCategory,
  ropaDataSubject,
  ropaLegalBasisEnum,
} from "./dpms";
import { document } from "./document";
import { biaAssessment } from "./bcms";
import { processEventLog } from "./bpm-advanced";

// ──────────────────────────────────────────────────────────────
// process_lane (0444) — Lane bzw. Pool mit ihrem Traeger
// ──────────────────────────────────────────────────────────────

export const processLane = pgTable(
  "process_lane",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    processId: uuid("process_id")
      .notNull()
      .references(() => process.id, { onDelete: "cascade" }),
    bpmnElementId: varchar("bpmn_element_id", { length: 100 }).notNull(),
    /** Stabile Identitaet ueber Round-Trips durch fremde Editoren (Plan §3.2). */
    stepKey: uuid("step_key").notNull().defaultRandom(),
    name: text("name"),
    /** `lane` | `pool` — CHECK in der Migration. */
    kind: varchar("kind", { length: 10 }).notNull().default("lane"),
    parentLaneId: uuid("parent_lane_id").references(
      (): AnyPgColumn => processLane.id,
      { onDelete: "cascade" },
    ),
    orgUnitId: uuid("org_unit_id").references(() => eamOrgUnit.id, {
      onDelete: "set null",
    }),
    // ON DELETE RESTRICT: Rolle und Dienstleister einer Lane sind Befunde
    // (SoD-Rueckfallrolle bzw. Vertrauensgrenze) — ein Loeschvorgang darf sie
    // nicht still mitnehmen (S09-10).
    customRoleId: uuid("custom_role_id").references(() => customRole.id, {
      onDelete: "restrict",
    }),
    vendorId: uuid("vendor_id").references(() => vendor.id, {
      onDelete: "restrict",
    }),
    isExternal: boolean("is_external").notNull().default(false),
    /** ISO-3166-1 alpha-2 des Sitzlandes, wenn Drittland. */
    thirdCountry: char("third_country", { length: 2 }),
    sequenceOrder: integer("sequence_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
  },
  (t) => [
    index("process_lane_org_idx").on(t.orgId),
    index("process_lane_process_idx").on(t.processId),
    index("process_lane_parent_idx").on(t.parentLaneId),
    index("process_lane_org_unit_idx").on(t.orgUnitId),
    index("process_lane_role_idx").on(t.customRoleId),
    index("process_lane_vendor_idx").on(t.vendorId),
    uniqueIndex("process_lane_element_uniq").on(t.processId, t.bpmnElementId),
    uniqueIndex("process_lane_step_key_uniq").on(t.processId, t.stepKey),
  ],
);

// ──────────────────────────────────────────────────────────────
// sod_rule (0446) — Regelmenge der Aufgabentrennung (F3)
// ──────────────────────────────────────────────────────────────

export const sodRule = pgTable(
  "sod_rule",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    // Die Selbstpaarung role_a_id = role_b_id ist ausdruecklich zulaessig —
    // sie ist der eigentliche Verstoss (STUFE2-A2-GRC.md §7.3). Deshalb gibt
    // es hier und in der Datenbank KEINE CHECK(role_a_id <> role_b_id).
    roleAId: uuid("role_a_id")
      .notNull()
      .references(() => customRole.id, { onDelete: "restrict" }),
    roleBId: uuid("role_b_id")
      .notNull()
      .references(() => customRole.id, { onDelete: "restrict" }),
    /** `low` | `medium` | `high` | `critical` — die vier Vertragsstufen. */
    severity: varchar("severity", { length: 10 }).notNull().default("high"),
    rationale: text("rationale"),
    frameworkRef: varchar("framework_ref", { length: 80 }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
  },
  (t) => [
    index("sod_rule_org_idx").on(t.orgId),
    index("sod_rule_role_a_idx").on(t.roleAId),
    index("sod_rule_role_b_idx").on(t.roleBId),
    index("sod_rule_active_idx").on(t.orgId, t.isActive),
    // sod_rule_pair_uniq ist ein funktionaler Index ueber
    // (org_id, LEAST(a,b), GREATEST(a,b)) und steht nur in Migration 0446.
  ],
);

// ──────────────────────────────────────────────────────────────
// process_step_raci (0447) — vollstaendige RACI-Zuordnung
// ──────────────────────────────────────────────────────────────

export const processStepRaci = pgTable(
  "process_step_raci",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    processStepId: uuid("process_step_id").notNull(),
    roleId: uuid("role_id")
      .notNull()
      .references(() => customRole.id, { onDelete: "restrict" }),
    /** `R` | `A` | `C` | `I`. varchar, nicht char — bpchar fuellt auf. */
    raciRole: varchar("raci_role", { length: 1 }).notNull(),
    /** `manual` | `derived` | `override`. */
    source: varchar("source", { length: 12 }).notNull().default("manual"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by"),
  },
  (t) => [
    index("process_step_raci_org_idx").on(t.orgId),
    index("process_step_raci_step_idx").on(t.processStepId),
    index("process_step_raci_role_idx").on(t.roleId),
    uniqueIndex("process_step_raci_uniq").on(
      t.processStepId,
      t.roleId,
      t.raciRole,
    ),
  ],
);

// ──────────────────────────────────────────────────────────────
// process_step_ropa (0448) — Art.-30-Angaben je Schritt
// ──────────────────────────────────────────────────────────────

export const processStepRopa = pgTable(
  "process_step_ropa",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    processStepId: uuid("process_step_id").notNull(),
    isProcessingActivity: boolean("is_processing_activity")
      .notNull()
      .default(false),
    purpose: text("purpose"),
    legalBasis: ropaLegalBasisEnum("legal_basis"),
    legalBasisDetail: text("legal_basis_detail"),
    retentionMonths: integer("retention_months"),
    retentionBasis: text("retention_basis"),
    requiresDpia: boolean("requires_dpia").notNull().default(false),
    dpiaId: uuid("dpia_id").references(() => dpia.id, {
      onDelete: "restrict",
    }),
    transferThirdCountry: boolean("transfer_third_country")
      .notNull()
      .default(false),
    /** ISO-3166-1 alpha-2, wie `process_lane.third_country`. */
    transferCountry: char("transfer_country", { length: 2 }),
    transferSafeguard: varchar("transfer_safeguard", { length: 120 }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
  },
  (t) => [
    index("process_step_ropa_org_idx").on(t.orgId),
    index("process_step_ropa_dpia_idx").on(t.dpiaId),
    uniqueIndex("process_step_ropa_step_uniq").on(t.processStepId),
  ],
);

// ──────────────────────────────────────────────────────────────
// process_step_data_category (0448)
// ──────────────────────────────────────────────────────────────

export const processStepDataCategory = pgTable(
  "process_step_data_category",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    processStepId: uuid("process_step_id").notNull(),
    ropaDataCategoryId: uuid("ropa_data_category_id")
      .notNull()
      .references(() => ropaDataCategory.id, { onDelete: "cascade" }),
    /**
     * Art.-9-Stufe. Ausdruecklich gesetzt und nicht aus dem Kategorienamen
     * abgeleitet — `ropa_data_category.category` ist Freitext.
     */
    isSpecialCategory: boolean("is_special_category").notNull().default(false),
    subjectTypeId: uuid("subject_type_id").references(
      () => ropaDataSubject.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by"),
  },
  (t) => [
    index("psdc_org_idx").on(t.orgId),
    index("psdc_step_idx").on(t.processStepId),
    index("psdc_category_idx").on(t.ropaDataCategoryId),
    index("psdc_subject_idx").on(t.subjectTypeId),
    uniqueIndex("psdc_step_category_uniq").on(
      t.processStepId,
      t.ropaDataCategoryId,
    ),
  ],
);

// ──────────────────────────────────────────────────────────────
// process_step_recipient (0448) — polymorph, ohne FK auf recipient_id
// ──────────────────────────────────────────────────────────────

export const processStepRecipient = pgTable(
  "process_step_recipient",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    processStepId: uuid("process_step_id").notNull(),
    /** Zeigt je nach `kind` auf `vendor` oder `eam_org_unit`. */
    recipientId: uuid("recipient_id").notNull(),
    /** `vendor` | `org_unit`. */
    kind: varchar("kind", { length: 12 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by"),
  },
  (t) => [
    index("psr_recipient_org_idx").on(t.orgId),
    index("psr_recipient_step_idx").on(t.processStepId),
    index("psr_recipient_target_idx").on(t.orgId, t.kind, t.recipientId),
    uniqueIndex("psr_recipient_uniq").on(
      t.processStepId,
      t.kind,
      t.recipientId,
    ),
  ],
);

// ──────────────────────────────────────────────────────────────
// process_step_bia (0449) — Kontinuitaet je Schritt, in MINUTEN
// ──────────────────────────────────────────────────────────────

export const processStepBia = pgTable(
  "process_step_bia",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    processStepId: uuid("process_step_id").notNull(),
    /** `very_high` | `high` | `medium` | `low` — Pflichtfeld des Vertrags. */
    criticality: varchar("criticality", { length: 10 }).notNull(),
    mtpdMinutes: integer("mtpd_minutes"),
    rtoMinutes: integer("rto_minutes"),
    rpoMinutes: integer("rpo_minutes"),
    impactCategories: jsonb("impact_categories")
      .notNull()
      .default(sql`'[]'::jsonb`),
    workaround: text("workaround"),
    /** 0 ist eine Aussage ("traegt nicht"), kein fehlender Wert (§7.4). */
    workaroundMaxDurationMinutes: integer("workaround_max_duration_minutes"),
    biaAssessmentId: uuid("bia_assessment_id").references(
      () => biaAssessment.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
  },
  (t) => [
    index("process_step_bia_org_idx").on(t.orgId),
    index("process_step_bia_assessment_idx").on(t.biaAssessmentId),
    uniqueIndex("process_step_bia_step_uniq").on(t.processStepId),
  ],
);

// ──────────────────────────────────────────────────────────────
// process_step_document (0450)
// ──────────────────────────────────────────────────────────────

export const processStepDocument = pgTable(
  "process_step_document",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    processStepId: uuid("process_step_id").notNull(),
    // ON DELETE RESTRICT: die Verknuepfung ist ein Nachweis (S09-10).
    documentId: uuid("document_id")
      .notNull()
      .references(() => document.id, { onDelete: "restrict" }),
    /** `sop` | `work_instruction` | `form` | `policy` | `evidence` | `other`. */
    relationType: varchar("relation_type", { length: 20 })
      .notNull()
      .default("sop"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by"),
  },
  (t) => [
    index("psdoc_org_idx").on(t.orgId),
    index("psdoc_step_idx").on(t.processStepId),
    index("psdoc_document_idx").on(t.documentId),
    uniqueIndex("psdoc_uniq").on(t.processStepId, t.documentId, t.relationType),
  ],
);

// ──────────────────────────────────────────────────────────────
// process_event_activity_map (0451) — der Torwaechter von F7
// ──────────────────────────────────────────────────────────────

export const processEventActivityMap = pgTable(
  "process_event_activity_map",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    eventLogId: uuid("event_log_id")
      .notNull()
      .references(() => processEventLog.id, { onDelete: "cascade" }),
    activityName: varchar("activity_name", { length: 500 }).notNull(),
    processStepId: uuid("process_step_id"),
    /** `exact` | `normalized` | `fuzzy` | `manual` | `unmapped`. */
    matchKind: varchar("match_kind", { length: 12 })
      .notNull()
      .default("unmapped"),
    confidence: numeric("confidence", { precision: 5, scale: 4 }),
    mappedBy: uuid("mapped_by").references(() => user.id, {
      onDelete: "set null",
    }),
    mappedAt: timestamp("mapped_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("peam_org_idx").on(t.orgId),
    index("peam_log_idx").on(t.eventLogId),
    index("peam_step_idx").on(t.processStepId),
    index("peam_mapped_by_idx").on(t.mappedBy),
    uniqueIndex("peam_log_activity_uniq").on(t.eventLogId, t.activityName),
  ],
);

// ──────────────────────────────────────────────────────────────
// process_event_transition_map (0476) — OP-012
// ──────────────────────────────────────────────────────────────

/**
 * [ARCTOS-FULL-2026-08-31 · OP-012] Beobachtete Uebergaenge je
 * Ereignisprotokoll.
 *
 * 0451 ordnet Aktivitaetsnamen einzelnen Elementen zu; ein Uebergang ist ein
 * PAAR, und aus zwei Knotenzuordnungen laesst sich keins rekonstruieren — die
 * Reihenfolge innerhalb eines Falls ist danach weg. Gespeichert wird deshalb
 * das Knotenpaar; Kantenkennungen fuehrt keine Tabelle dieses Schemas (die
 * ausfuehrliche Begruendung steht im Kopf der Migration).
 */
export const processEventTransitionMap = pgTable(
  "process_event_transition_map",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    eventLogId: uuid("event_log_id")
      .notNull()
      .references(() => processEventLog.id, { onDelete: "cascade" }),
    processId: uuid("process_id").references(() => process.id, {
      onDelete: "cascade",
    }),
    fromElementId: varchar("from_element_id", { length: 100 }).notNull(),
    toElementId: varchar("to_element_id", { length: 100 }).notNull(),
    frequency: integer("frequency").notNull().default(0),
    /**
     * BEOBACHTETE Quote, keine Modellaussage: `frequency` geteilt durch alle
     * beobachteten Uebergaenge ab `from_element_id`. Ein nie beobachteter
     * Zweig kommt in dieser Rechnung nicht vor.
     */
    probability: numeric("probability", { precision: 6, scale: 5 }),
    isModelled: boolean("is_modelled").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("petm_org_idx").on(t.orgId),
    index("petm_log_idx").on(t.eventLogId),
    index("petm_process_idx").on(t.processId),
    uniqueIndex("petm_log_pair_uniq").on(
      t.eventLogId,
      t.fromElementId,
      t.toElementId,
    ),
  ],
);

// ──────────────────────────────────────────────────────────────
// user_diagram_preference (0452)
// ──────────────────────────────────────────────────────────────

export const userDiagramPreference = pgTable(
  "user_diagram_preference",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    scope: varchar("scope", { length: 40 }).notNull().default("default"),
    activeView: varchar("active_view", { length: 32 }),
    layers: jsonb("layers")
      .notNull()
      .default(sql`'[]'::jsonb`),
    /**
     * [ARCTOS-FULL-2026-08-31 · OP-016] Gewaehltes Rahmenwerk der Sicht F8
     * (Migration 0475).
     *
     * Vergleichsgroesse ist `process_framework_mapping.framework_code` — eine
     * freie Zeichenkette, kein Schluessel. Ein Fremdschluessel auf `catalog`
     * waere hier eine ANDERE Groesse unter demselben Namen: er liesse sich
     * speichern und traefe in `computeFrameworkElement` nie eine Zuordnung.
     */
    frameworkCode: varchar("framework_code", { length: 40 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("udp_org_idx").on(t.orgId),
    index("udp_user_idx").on(t.userId),
    uniqueIndex("udp_user_scope_uniq").on(t.orgId, t.userId, t.scope),
  ],
);
