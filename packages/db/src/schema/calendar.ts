// Sprint 17: Compliance Calendar Schema (Drizzle ORM)
// 1 entity: complianceCalendarEvent (manual events only)
// Calendar aggregation is done via UNION ALL across existing tables at query time

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { organization, user } from "./platform";

// ──────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────

export const calendarEventTypeEnum = pgEnum("calendar_event_type", [
  "meeting",
  "workshop",
  "review",
  "training",
  "deadline",
  "other",
]);

export const calendarRecurrenceEnum = pgEnum("calendar_recurrence", [
  "none",
  "weekly",
  "monthly",
  "quarterly",
  "annually",
]);

// ──────────────────────────────────────────────────────────────
// 17.1 ComplianceCalendarEvent — Manual calendar events
// Aggregated (module-sourced) events have NO table; they are
// queried via UNION ALL at runtime.
// ──────────────────────────────────────────────────────────────

export const complianceCalendarEvent = pgTable(
  "compliance_calendar_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }),
    isAllDay: boolean("is_all_day").notNull().default(false),
    eventType: calendarEventTypeEnum("event_type").notNull(),
    module: varchar("module", { length: 20 }),
    recurrence: calendarRecurrenceEnum("recurrence").notNull().default("none"),
    recurrenceEndAt: timestamp("recurrence_end_at", { withTimezone: true }),
    // Cross-cutting mandatory fields
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by").references(() => user.id),
    updatedBy: uuid("updated_by"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by"),
  },
  (table) => [
    index("cce_org_idx").on(table.orgId),
    index("cce_date_idx").on(table.orgId, table.startAt),
    index("cce_type_idx").on(table.orgId, table.eventType),
  ],
);
