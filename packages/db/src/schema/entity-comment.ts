// #NIGHT-035: polymorphic entity_comment table — see migration 0306.
//
// Linked to any domain entity via (entityType, entityId). Used by
// /api/v1/{domain}/{id}/comments routes for cross-domain consistency.

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  index,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { organization, user } from "./platform";

export const entityComment = pgTable(
  "entity_comment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    entityType: varchar("entity_type", { length: 100 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    body: text("body").notNull(),
    parentCommentId: uuid("parent_comment_id").references(
      (): AnyPgColumn => entityComment.id,
      { onDelete: "cascade" },
    ),
    editCount: integer("edit_count").notNull().default(0),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by").references(() => user.id),
  },
  (t) => [
    index("ec_entity_idx").on(t.orgId, t.entityType, t.entityId, t.createdAt),
    index("ec_parent_idx").on(t.parentCommentId),
  ],
);
