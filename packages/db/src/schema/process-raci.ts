// Sprint 56: BPM UX & Derived Views — RACI Override Schema (Drizzle ORM)
// New table: process_raci_override

import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { organization, user } from "./platform";

// ──────────────────────────────────────────────────────────────
// process_raci_override — Manual RACI assignment overrides
// ──────────────────────────────────────────────────────────────

export const processRaciOverride = pgTable(
  "process_raci_override",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    processVersionId: uuid("process_version_id").notNull(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    activityBpmnId: varchar("activity_bpmn_id", { length: 100 }).notNull(),
    participantBpmnId: varchar("participant_bpmn_id", {
      length: 100,
    }).notNull(),
    raciRole: varchar("raci_role", { length: 1 }).notNull(),
    overriddenBy: uuid("overridden_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("pro_version_activity_participant_uniq").on(
      table.processVersionId,
      table.activityBpmnId,
      table.participantBpmnId,
    ),
    index("pro_version_idx").on(table.processVersionId),
    index("pro_org_idx").on(table.orgId),
  ],
);
