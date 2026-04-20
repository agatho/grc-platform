import { db } from "@grc/db";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/dpms/audit-log-tombstone
//
// GDPR Art. 17 (right to erasure) — redacts PII from a specific audit_log
// row without breaking the hash chain. Backed by the tombstone_audit_entry
// SQL function (see migration 0284). The function rewrites user_email,
// user_name, ip_address and any PII-tagged keys in the `changes` JSON with
// deterministic hashes; the entry_hash is preserved so the chain stays
// verifiable.
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

export async function POST(req: Request) {
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
}
