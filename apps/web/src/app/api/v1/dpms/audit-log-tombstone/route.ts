import { db } from "@grc/db";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// POST /api/v1/dpms/audit-log-tombstone
//
// GDPR Art. 17 (right to erasure) — redacts PII from a specific audit_log
// row. Backed by the tombstone_audit_entry SQL function (migration 0284).
// It rewrites user_email, user_name, ip_address and any PII-tagged keys in
// the `changes` JSON with deterministic hashes.
//
// ── What the previous version of this comment got wrong (S03-06) ──────
//
// It claimed the redaction happens "without breaking the hash chain" and
// that "the entry_hash is preserved so the chain stays verifiable". The
// first half was true; the second did not follow. `entry_hash` was
// preserved, but `changes` is a direct hash INPUT in v1, v2 and v3, so
// the recompute diverged and the row failed verification permanently.
// The consequence was measured, not theoretical: after the first real
// erasure request `GET /api/v1/audit-log/integrity` answered 503 for
// ever, leaving the customer to choose between honouring Art. 17 and
// having a verifiable audit trail. The integration test asserted only
// `expect(after.entry_hash).toBe(originalHash)` and passed throughout.
//
// Since ADR-011 rev.4 (migration 0400) the row hash covers a *content
// commitment* rather than the payload itself. A redaction rewrites the
// payload and preserves the commitment, so a v4 row still recomputes and
// still verifies after erasure. Rows written under v1–v3 cannot be
// repaired retroactively — their payload was hashed directly — so for
// those the redaction is recorded as its own chained entry
// (`entity_type='audit_log'`, `action_detail='pii_tombstone'`, written by
// the AFTER UPDATE trigger from migration 0401) and the verifier
// classifies them as `redacted_legacy` rather than as a tamper. A
// tombstoned pre-v4 row WITHOUT that redaction event is reported as a
// mismatch — that is what tampering disguised as erasure looks like.
//
// Access: admin + DPO. The DPO role is the primary authorised caller;
// admin is allowed so break-glass operations are possible when the DPO
// is unavailable. Every call writes a meta-audit entry on a dedicated
// `gdpr_action` record so the tombstoning itself is auditable.
//
// Input:
//   { auditLogId: uuid, reason: "gdpr_art_17" | "person_deceased" | "contract_end" | "legal_hold_expired" | "data_minimisation" }
//
// Responses:
//   200 { tombstonedId, previousEntryHash } — success
//   422 validation error
//   409 row is already tombstoned
//   404 row not found or belongs to a different org

const TOMBSTONE_REASONS = [
  "gdpr_art_17",
  "person_deceased",
  "contract_end",
  "legal_hold_expired",
  "data_minimisation",
] as const;

const tombstoneSchema = z.object({
  auditLogId: z.string().uuid(),
  reason: z.enum(TOMBSTONE_REASONS),
});

export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin", "dpo");
  if (ctx instanceof Response) return ctx;

  const rawBody = await req.json().catch(() => null);
  const parsed = tombstoneSchema.safeParse(rawBody);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }
  const { auditLogId, reason } = parsed.data;

  // Confirm the audit row belongs to this caller's org before invoking
  // the SQL function. Platform-wide access to audit rows is explicitly
  // not permitted from this endpoint — a DPO in org A cannot tombstone
  // an entry that belongs to org B. Returning 404 hides cross-tenant
  // existence.
  const existing = await db.execute<{
    id: string;
    entry_hash: string;
    pii_tombstoned_at: Date | null;
  }>(sql`
    SELECT id, entry_hash, pii_tombstoned_at
    FROM audit_log
    WHERE id = ${auditLogId}::uuid AND org_id = ${ctx.orgId}::uuid
    LIMIT 1
  `);

  const existingRows = Array.isArray(existing) ? existing : [];

  if (existingRows.length === 0) {
    return Response.json(
      { error: "Audit log entry not found" },
      { status: 404 },
    );
  }

  if (existingRows[0].pii_tombstoned_at) {
    return Response.json(
      {
        error: "Audit log entry is already tombstoned",
        tombstonedAt: existingRows[0].pii_tombstoned_at,
      },
      { status: 409 },
    );
  }

  const previousEntryHash = existingRows[0].entry_hash;

  try {
    await withAuditContext(ctx, async (tx) => {
      await tx.execute(
        sql`SELECT tombstone_audit_entry(${auditLogId}::uuid, ${reason})`,
      );
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("already tombstoned")) {
      return Response.json(
        { error: "Audit log entry is already tombstoned" },
        { status: 409 },
      );
    }
    if (msg.includes("does not exist")) {
      return Response.json(
        { error: "Audit log entry not found" },
        { status: 404 },
      );
    }
    throw err;
  }

  return Response.json({
    data: {
      tombstonedId: auditLogId,
      reason,
      previousEntryHash,
    },
  });
});
