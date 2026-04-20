// Generic Checklists (ADR-014 Phase 3)
//
// Generic Template + Instance-Struktur fuer Checklisten die nicht an eine
// spezifische Domain gebunden sind (Audit hat eigene audit_checklist).
// Migration: 0080_round3_features.sql

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

export const checklistTemplate = pgTable("checklist_template", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organization.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 50 }),
  // Array<{ id: string; label: string; required: boolean; type: string }>
  items: jsonb("items").default([]).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdBy: uuid("created_by").references(() => user.id),
});

export const checklistInstance = pgTable("checklist_instance", {
  id: uuid("id").primaryKey().defaultRandom(),
  templateId: uuid("template_id").references(() => checklistTemplate.id),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organization.id),
  entityType: varchar("entity_type", { length: 50 }),
  entityId: uuid("entity_id"),
  name: varchar("name", { length: 255 }).notNull(),
  // Array<{ id: string; label: string; done: boolean; note?: string }>
  items: jsonb("items").default([]).notNull(),
  completedItems: integer("completed_items").default(0),
  totalItems: integer("total_items").default(0),
  // open | in_progress | completed | cancelled
  status: varchar("status", { length: 20 }).default("open").notNull(),
  assignedTo: uuid("assigned_to").references(() => user.id),
  dueDate: date("due_date"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdBy: uuid("created_by").references(() => user.id),
});
