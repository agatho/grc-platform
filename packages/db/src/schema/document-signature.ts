// W21-DMS-MULTISIGN-01: Multi-signer e-signature workflow for documents.
//
// In-house implementation (decision 2026-07-11, follow-up to the Wave-19
// scope decision docs/qa-reports/wave19-n7-dms-scope-decision.md).
// Pattern lineage: process_sign_off / audit_sign_off / vendor_sign_off
// (SHA-256 hash chain, UNIQUE previous_chain_hash concurrency guard,
// IP + user agent capture) combined with document_approval_step
// (pre-created ordered assignee rows).
//
// Two tables:
//   document_signature_request — one signing ceremony per document version.
//     The version AND its file_sha256 are frozen at request creation; a
//     later re-upload invalidates signing (422 in the sign route).
//   document_signature — one row per signer, created upfront as 'pending'
//     with a sign_order. On sign/decline the row receives its hash-chain
//     link: content_hash = SHA-256 over the canonical payload
//     (documentId + versionId + fileSha256 + signerUserId + signedAt +
//     decision), chain_hash = SHA-256(previous_chain_hash + content_hash).
//
// Concurrency guard (migration 0375): a partial UNIQUE index
//   (request_id, previous_chain_hash) NULLS NOT DISTINCT
//   WHERE content_hash IS NOT NULL
// rejects two concurrent signatures claiming the same chain head
// (pattern: 0341_signoff_chain_concurrency_guard). It is intentionally
// NOT modeled here — Drizzle's unique() cannot express partial +
// NULLS NOT DISTINCT indexes.

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  pgEnum,
  index,
  unique,
  customType,
} from "drizzle-orm/pg-core";
import { organization, user } from "./platform";
import { document, documentVersion } from "./document";

// ──────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────

export const documentSignatureRequestStatusEnum = pgEnum(
  "document_signature_request_status",
  // "invalidated" (migration 0420, #S06-23): the frozen file changed after
  // the request was created, so no further signature can ever be given.
  // The request used to stay "pending" forever — the reminder cron kept
  // chasing a ceremony that was technically dead.
  ["pending", "completed", "declined", "cancelled", "invalidated"],
);

export const documentSignatureStatusEnum = pgEnum("document_signature_status", [
  "pending",
  "signed",
  "declined",
]);

// ──────────────────────────────────────────────────────────────
// document_signature_request — signing ceremony (frozen version)
// ──────────────────────────────────────────────────────────────

export const documentSignatureRequest = pgTable(
  "document_signature_request",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    documentId: uuid("document_id")
      .notNull()
      .references(() => document.id, { onDelete: "cascade" }),
    // Frozen at creation: the exact version being signed …
    versionId: uuid("version_id")
      .notNull()
      .references(() => documentVersion.id, { onDelete: "restrict" }),
    // … and the exact file hash at that moment. The sign route compares
    // this against the live document_version.file_sha256 and refuses to
    // sign (422) if the bytes changed after the request was issued.
    fileSha256: varchar("file_sha256", { length: 64 }).notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    message: text("message"),
    status: documentSignatureRequestStatusEnum("status")
      .notNull()
      .default("pending"),
    // true → signers must sign in sign_order; false → any order
    sequential: boolean("sequential").notNull().default(false),
    dueDate: timestamp("due_date", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    // Cron staging (migration 0376, W21-DMS-MULTISIGN-02): anchor for the
    // staged due-date reminders (3 days before / on due date) sent by the
    // signature-due-reminder worker cron — pattern document.lastReminderSentAt.
    lastReminderSentAt: timestamp("last_reminder_sent_at", {
      withTimezone: true,
    }),
    // One-time marker: overdue escalation (> 3 days past dueDate) to the
    // request creator + document owner was sent. Deliberately no auto-cancel.
    escalatedAt: timestamp("escalated_at", { withTimezone: true }),
    // ── Chain completeness (migration 0420, #S06-15) ────────────────
    // A forward-only chain verification cannot detect that something was
    // cut off the END — every prefix of a valid chain is a valid chain.
    // These three columns give verify() the expected shape.
    /** Number of signer slots created with the request. */
    signatureCount: integer("signature_count"),
    /** Number of decided (signed/declined) chain links. */
    chainLength: integer("chain_length").notNull().default(0),
    /** chain_hash of the last appended link — the expected chain head. */
    finalChainHash: varchar("final_chain_hash", { length: 64 }),
    /** #S06-13: the requester is among the signers (self-attestation). */
    creatorIsSigner: boolean("creator_is_signer").notNull().default(false),
    // #S06-23: explicit end state when the frozen file changed.
    invalidatedAt: timestamp("invalidated_at", { withTimezone: true }),
    invalidatedReason: text("invalidated_reason"),
    // Cross-cutting mandatory fields
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by").references(() => user.id),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("dsr_req_org_idx").on(table.orgId),
    index("dsr_req_document_idx").on(table.documentId, table.status),
    index("dsr_req_version_idx").on(table.versionId),
  ],
);

// ──────────────────────────────────────────────────────────────
// document_signature — one signer slot + hash-chain link
// ──────────────────────────────────────────────────────────────

export const documentSignature = pgTable(
  "document_signature",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    requestId: uuid("request_id")
      .notNull()
      .references(() => documentSignatureRequest.id, { onDelete: "cascade" }),
    signerUserId: uuid("signer_user_id")
      .notNull()
      .references(() => user.id),
    signOrder: integer("sign_order").notNull(),
    status: documentSignatureStatusEnum("status").notNull().default("pending"),
    signedAt: timestamp("signed_at", { withTimezone: true }),
    declineReason: text("decline_reason"),
    // Hash chain (NULL while pending; set atomically on sign/decline).
    // content_hash = SHA-256(canonical JSON of documentId + versionId +
    // fileSha256 + signerUserId + signedAt + decision) — see
    // apps/web/src/lib/documents/signature-chain.ts
    contentHash: varchar("content_hash", { length: 64 }),
    previousChainHash: varchar("previous_chain_hash", { length: 64 }),
    chainHash: varchar("chain_hash", { length: 64 }),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: text("user_agent"),
    /** #S06-03: which content_hash formula this row was written with.
     *  1 = the original six metadata fields, 2 = plus ipAddress,
     *  userAgent, declineReason and signOrder. Existing rows keep
     *  verifying under their own version (migration 0420). */
    hashVersion: integer("hash_version").notNull().default(1),
    /** #S06-03: true only when ipAddress came from a position in
     *  X-Forwarded-For that a client cannot set (TRUSTED_PROXY_HOPS). */
    ipTrusted: boolean("ip_trusted"),
    // ── RFC 3161 timestamp (migration 0420, #S06-05) ────────────────
    /** granted | unavailable | disabled | error */
    tsaStatus: varchar("tsa_status", { length: 24 }),
    tsaGenTime: timestamp("tsa_gen_time", { withTimezone: true }),
    tsaSerial: varchar("tsa_serial", { length: 128 }),
    tsaPolicyOid: varchar("tsa_policy_oid", { length: 64 }),
    /** DER-encoded TimeStampResp over this link's chain_hash. */
    tsaProof: customType<{ data: Buffer; driverData: Buffer }>({
      dataType: () => "bytea",
    })("tsa_proof"),
    // Cross-cutting mandatory fields
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("dsig_org_idx").on(table.orgId),
    index("dsig_request_idx").on(table.requestId, table.signOrder),
    index("dsig_signer_status_idx").on(table.signerUserId, table.status),
    unique("dsig_request_signer_unique").on(
      table.requestId,
      table.signerUserId,
    ),
    // dsig_request_prev_chain_uniq (partial, NULLS NOT DISTINCT) lives in
    // migration 0375 — see header comment.
  ],
);
