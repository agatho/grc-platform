// Sprint 53: EAM Governance & Deep Integration
// Tables: eam_governance_log, eam_bpmn_element_placement

import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organization, user } from "./platform";
import { architectureElement } from "./eam";

// ──────────────────────────────────────────────────────────────
// EAM Governance Log (IMMUTABLE — no UPDATE/DELETE)
// ──────────────────────────────────────────────────────────────

export const eamGovernanceLog = pgTable(
  "eam_governance_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    elementId: uuid("element_id").notNull(),
    elementType: varchar("element_type", { length: 30 }).notNull(),
    fromStatus: varchar("from_status", { length: 20 }),
    toStatus: varchar("to_status", { length: 20 }).notNull(),
    action: varchar("action", { length: 20 }).notNull(),
    performedBy: uuid("performed_by")
      .notNull()
      .references(() => user.id),
    justification: text("justification"),
    performedAt: timestamp("performed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgIdx: index("egl_org_idx").on(table.orgId),
    elementIdx: index("egl_element_idx").on(table.elementId),
    actionIdx: index("egl_action_idx").on(table.orgId, table.action),
    performedByIdx: index("egl_performed_by_idx").on(table.performedBy),
    dateIdx: index("egl_date_idx").on(table.orgId, table.performedAt),
  }),
);

export const eamGovernanceLogRelations = relations(
  eamGovernanceLog,
  ({ one }) => ({
    organization: one(organization, {
      fields: [eamGovernanceLog.orgId],
      references: [organization.id],
    }),
    performer: one(user, {
      fields: [eamGovernanceLog.performedBy],
      references: [user.id],
    }),
  }),
);

// ──────────────────────────────────────────────────────────────
// EAM BPMN Element Placement (EAM objects in BPMN diagrams)
// ──────────────────────────────────────────────────────────────

export const eamBpmnElementPlacement = pgTable(
  "eam_bpmn_element_placement",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    processVersionId: uuid("process_version_id").notNull(),
    eamElementId: uuid("eam_element_id")
      .notNull()
      .references(() => architectureElement.id),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    placementType: varchar("placement_type", { length: 20 }).notNull(),
    bpmnNodeId: varchar("bpmn_node_id", { length: 100 }),
    positionX: numeric("position_x"),
    positionY: numeric("position_y"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    processIdx: index("ebep_process_idx").on(table.processVersionId),
    elementIdx: index("ebep_element_idx").on(table.eamElementId),
    orgIdx: index("ebep_org_idx").on(table.orgId),
  }),
);

export const eamBpmnElementPlacementRelations = relations(
  eamBpmnElementPlacement,
  ({ one }) => ({
    eamElement: one(architectureElement, {
      fields: [eamBpmnElementPlacement.eamElementId],
      references: [architectureElement.id],
    }),
    organization: one(organization, {
      fields: [eamBpmnElementPlacement.orgId],
      references: [organization.id],
    }),
  }),
);
