/**
 * Audit-chain integrity tables (ADR-011 rev.4).
 *
 * Created by migrations 0400–0407 during the ARCTOS-FULL-2026-08-31
 * remediation (stream S03, work package WP4). They are declared here so
 * `/api/v1/health/schema-drift` and the CI drift job see the same schema
 * the migrations build — a table that exists in the database but not in
 * the Drizzle exports is reported as `extraInDb`, which is how the drift
 * report stops being trustworthy.
 *
 * None of these tables is written through Drizzle. `audit_anchor_seal` is
 * revoked from every application role and reachable only through the
 * SECURITY DEFINER seal functions; the other three are written by database
 * triggers or by `audit_chain_verify_and_record()`. The declarations exist
 * for the drift comparison and for type-safe reads.
 */
import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
  integer,
  smallint,
  bigserial,
  bigint,
  date,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";

// ──────────────────────────────────────────────────────────────
// audit_anchor_seal — chained, HMAC-signed ledger of every anchor
// (S03-01). The HMAC key lives in the application environment, never
// in the database, so an actor with database access alone cannot
// produce a seal that verifies.
// ──────────────────────────────────────────────────────────────

export const auditAnchorSeal = pgTable(
  "audit_anchor_seal",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sealSeq: bigserial("seal_seq", { mode: "number" }).notNull(),
    orgId: uuid("org_id"),
    anchorDate: date("anchor_date").notNull(),
    provider: varchar("provider", { length: 32 }).notNull(),
    merkleRoot: varchar("merkle_root", { length: 64 }).notNull(),
    leafCount: integer("leaf_count").notNull(),
    merkleVersion: smallint("merkle_version").notNull().default(1),
    /** Chain tip of the tenant's audit_log at seal time. */
    chainTipHash: varchar("chain_tip_hash", { length: 64 }),
    chainTipSeq: bigint("chain_tip_seq", { mode: "number" }),
    proofSha256: varchar("proof_sha256", { length: 64 }),
    /** Digest over exactly the fields that make an anchor evidence. */
    anchorDigest: varchar("anchor_digest", { length: 64 }).notNull(),
    prevSealHash: varchar("prev_seal_hash", { length: 64 }),
    sealHash: varchar("seal_hash", { length: 64 }).notNull(),
    sealHmac: varchar("seal_hmac", { length: 64 }),
    sealKeyId: text("seal_key_id").notNull().default("unsealed"),
    sealedAt: timestamp("sealed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    sealedBy: text("sealed_by").notNull(),
  },
  (table) => [
    index("audit_anchor_seal_lookup_idx").on(
      table.orgId,
      table.anchorDate,
      table.provider,
    ),
    uniqueIndex("audit_anchor_seal_hash_uniq").on(table.sealHash),
    uniqueIndex("audit_anchor_seal_prev_uniq").on(table.prevSealHash),
  ],
);

// ──────────────────────────────────────────────────────────────
// audit_chain_verification — result of every automatic full-chain
// verification run (S03-12).
// ──────────────────────────────────────────────────────────────

export const auditChainVerification = pgTable(
  "audit_chain_verification",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runSeq: bigserial("run_seq", { mode: "number" }).notNull(),
    orgId: uuid("org_id"),
    scope: text("scope").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    rowsChecked: integer("rows_checked").notNull().default(0),
    healthy: boolean("healthy").notNull().default(false),
    anchorIssues: integer("anchor_issues").notNull().default(0),
    refusedWrites: integer("refused_writes").notNull().default(0),
    result: jsonb("result").notNull(),
    triggeredBy: text("triggered_by").notNull().default("cron"),
  },
  (table) => [
    index("audit_chain_verification_scope_idx").on(
      table.scope,
      table.startedAt,
    ),
  ],
);

// ──────────────────────────────────────────────────────────────
// audit_sensitive_column — declarative deny list of columns whose
// values must never reach audit_log.changes (S03-14).
// ──────────────────────────────────────────────────────────────

export const auditSensitiveColumn = pgTable(
  "audit_sensitive_column",
  {
    entityType: text("entity_type").notNull(),
    columnName: text("column_name").notNull(),
    reason: text("reason").notNull().default("credential"),
  },
  (table) => [primaryKey({ columns: [table.entityType, table.columnName] })],
);

// ──────────────────────────────────────────────────────────────
// audit_log_write_attempt — refused destructive operations on the
// log tables (S03-16). A DELETE against audit_log used to return
// "DELETE 0": prevented, but invisible to the caller and to
// monitoring.
// ──────────────────────────────────────────────────────────────

export const auditLogWriteAttempt = pgTable("audit_log_write_attempt", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  attemptedAt: timestamp("attempted_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  operation: text("operation").notNull(),
  tableName: text("table_name").notNull(),
  dbUser: text("db_user").notNull(),
  rowId: uuid("row_id"),
  detail: text("detail"),
});
