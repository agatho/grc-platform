import { db, auditLog, auditAnchor } from "@grc/db";
import { and, eq, isNotNull, gte, lt, asc, desc, sql } from "drizzle-orm";
import { merkleRoot } from "@grc/shared/lib/merkle-tree";
import * as freetsa from "@grc/shared/lib/freetsa";
import * as opentimestamps from "@grc/shared/lib/opentimestamps";
import { withAuth } from "@/lib/api";

// POST /api/v1/audit-log/anchor
//
// Manually trigger an external tamper-evidence anchor for the caller's
// tenant. This is the same logic the nightly cron (apps/worker) runs,
// exposed as an API endpoint so (a) admins can anchor on demand before
// a regulatory audit and (b) tests and Alpha demos don't have to wait
// 24h for the cron.
//
// Body (optional):
//   { "date": "YYYY-MM-DD" }   — UTC day to anchor. Default: today.
//   { "providers": ["freetsa" | "opentimestamps"] } — which providers to
//     try. Default: both.
//
// The endpoint is idempotent per (org, day, provider) via the unique
// index on audit_anchor. A second call on the same day just returns
// the existing anchor.
//
// Admin/auditor only — anchoring is operationally cheap but still a
// write, and the endpoint talks to external networks. The tombstone
// endpoint's dual-control rationale doesn't apply here because there's
// nothing to rollback.

interface AnchorResponse {
  orgId: string;
  date: string;
  leafCount: number;
  merkleRoot: string | null;
  results: Array<{
    provider: "freetsa" | "opentimestamps";
    status: "created" | "existing" | "skipped" | "failed";
    proofStatus?: string;
    error?: string;
  }>;
}

export async function POST(req: Request) {
  const ctx = await withAuth("admin", "auditor");
  if (ctx instanceof Response) return ctx;

  const body = await req.json().catch(() => ({}));
  const dateStr: string = body.date ?? new Date().toISOString().slice(0, 10);
  const providers: Array<"freetsa" | "opentimestamps"> =
    Array.isArray(body.providers) && body.providers.length > 0
      ? body.providers
      : ["freetsa", "opentimestamps"];

  const dayStart = new Date(dateStr + "T00:00:00Z");
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  if (isNaN(dayStart.getTime())) {
    return Response.json({ error: "Invalid date" }, { status: 422 });
  }

  // #WAVE10-CRITICAL-01: refuse to anchor a chain that's failing
  // self-verification — either rowMismatches (stored entry_hash diverges
  // from the recompute) OR chainMismatches (stored previous_hash
  // diverges from the prior row's entry_hash in chain_seq order).
  //
  // Wave 9's gate only checked rowMismatches and let the anchor through
  // when the chain was structurally broken but every individual row's
  // hash was internally consistent. FreeTSA then signed a Merkle root
  // that included rows whose chain pointers were wrong — exactly the
  // permanent-trust corruption the gate was meant to prevent.
  //
  // Single SQL query computes both counts via a CTE so we get one
  // round-trip. ORDER BY chain_seq matches integrity/route.ts.
  const scope = `org:${ctx.orgId}`;
  const [{ row_broken, chain_broken }] = await db.execute<{
    row_broken: number;
    chain_broken: number;
  }>(sql`
    WITH walked AS (
      SELECT
        hash_version,
        previous_hash AS stored_prev,
        entry_hash    AS stored_eh,
        LAG(entry_hash) OVER (ORDER BY chain_seq) AS expected_prev,
        CASE
          WHEN hash_version = 2 THEN compute_audit_hash_v2(
            previous_hash, org_id, user_id, entity_type, entity_id,
            action::text, changes, action_detail, metadata, created_at,
            previous_hash_scope
          )
          WHEN hash_version = 1 THEN compute_audit_hash_v1(
            previous_hash, org_id, user_id, entity_type, entity_id,
            action::text, changes, created_at, previous_hash_scope
          )
          ELSE entry_hash
        END AS expected_eh
      FROM audit_log
      WHERE previous_hash_scope = ${scope}
    )
    SELECT
      COUNT(*) FILTER (
        WHERE hash_version <> 0 AND stored_eh <> expected_eh
      )::int AS row_broken,
      COUNT(*) FILTER (
        WHERE hash_version <> 0
          AND COALESCE(stored_prev, '') <> COALESCE(expected_prev, '')
      )::int AS chain_broken
    FROM walked
  `);

  const totalBroken = (row_broken ?? 0) + (chain_broken ?? 0);
  if (totalBroken > 0) {
    return Response.json(
      {
        type: "https://arctos.charliehund.de/errors/chain-not-anchorable",
        title: "Audit chain integrity broken — refusing to anchor",
        status: 409,
        detail: `Found ${row_broken ?? 0} row mismatch(es) and ${chain_broken ?? 0} chain mismatch(es). Anchoring now would propagate the broken state into the timestamp authority and make the corruption permanent. GET /api/v1/audit-log/integrity for the full diff. If broken_hash_window warnings appear, run 0312_rehash_v0_audit_entries.sql; if chain mismatches appear, run 0313_audit_chain_seq.sql.`,
        brokenRowCount: row_broken ?? 0,
        brokenChainCount: chain_broken ?? 0,
        integrityCheck: "/api/v1/audit-log/integrity",
      },
      { status: 409 },
    );
  }

  // Collect leaves for this tenant on this day
  const leafRows = await db
    .select({ entryHash: auditLog.entryHash })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.orgId, ctx.orgId),
        gte(auditLog.createdAt, dayStart),
        lt(auditLog.createdAt, dayEnd),
        isNotNull(auditLog.entryHash),
      ),
    )
    .orderBy(asc(auditLog.createdAt), asc(auditLog.id));

  const leaves = leafRows
    .map((r) => r.entryHash)
    .filter((h): h is string => !!h);
  const root = merkleRoot(leaves);

  const response: AnchorResponse = {
    orgId: ctx.orgId,
    date: dateStr,
    leafCount: leaves.length,
    merkleRoot: root,
    results: [],
  };

  if (!root) {
    return Response.json({
      ...response,
      results: providers.map((p) => ({
        provider: p,
        status: "skipped" as const,
      })),
      message: "No audit entries on this day — nothing to anchor.",
    });
  }

  const rootBuffer = Buffer.from(root, "hex");

  for (const provider of providers) {
    try {
      const existing = await db
        .select({ proofStatus: auditAnchor.proofStatus })
        .from(auditAnchor)
        .where(
          and(
            eq(auditAnchor.orgId, ctx.orgId),
            eq(auditAnchor.anchorDate, dateStr),
            eq(auditAnchor.provider, provider),
          ),
        )
        .limit(1);

      if (existing.length > 0 && existing[0].proofStatus !== "failed") {
        response.results.push({
          provider,
          status: "existing",
          proofStatus: existing[0].proofStatus,
        });
        continue;
      }

      if (provider === "freetsa") {
        const tsa = await freetsa.requestTimestamp(rootBuffer);
        if (tsa.statusCode !== 0) {
          throw new Error(`FreeTSA returned status ${tsa.statusCode}`);
        }
        await upsertAnchor({
          orgId: ctx.orgId,
          date: dateStr,
          provider,
          root,
          leafCount: leaves.length,
          proof: tsa.proof.toString("base64"),
          proofStatus: "complete",
        });
        response.results.push({
          provider,
          status: "created",
          proofStatus: "complete",
        });
      } else {
        const ots = await opentimestamps.submitToAnyCalendar(rootBuffer);
        await upsertAnchor({
          orgId: ctx.orgId,
          date: dateStr,
          provider,
          root,
          leafCount: leaves.length,
          proof: ots.stub.toString("base64"),
          proofStatus: "pending",
        });
        response.results.push({
          provider,
          status: "created",
          proofStatus: "pending",
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      response.results.push({ provider, status: "failed", error: msg });
      // Also record the failure in the anchor table for operator visibility
      await upsertAnchor({
        orgId: ctx.orgId,
        date: dateStr,
        provider,
        root,
        leafCount: leaves.length,
        proof: "",
        proofStatus: "failed",
        lastError: msg,
      }).catch(() => {
        /* ignore nested failure */
      });
    }
  }

  return Response.json(response);
}

// GET /api/v1/audit-log/anchor — status of recent anchors for this tenant
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "auditor");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const limit = Math.min(100, Number(url.searchParams.get("limit") ?? 30));

  const rows = await db
    .select({
      id: auditAnchor.id,
      anchorDate: auditAnchor.anchorDate,
      provider: auditAnchor.provider,
      merkleRoot: auditAnchor.merkleRoot,
      leafCount: auditAnchor.leafCount,
      proofStatus: auditAnchor.proofStatus,
      bitcoinBlockHeight: auditAnchor.bitcoinBlockHeight,
      lastError: auditAnchor.lastError,
      createdAt: auditAnchor.createdAt,
      upgradedAt: auditAnchor.upgradedAt,
    })
    .from(auditAnchor)
    .where(eq(auditAnchor.orgId, ctx.orgId))
    .orderBy(desc(auditAnchor.anchorDate), asc(auditAnchor.provider))
    .limit(limit);

  // Latest anchor per provider — the UI uses this for the badge
  const latestByProvider: Record<string, (typeof rows)[number] | undefined> =
    {};
  for (const r of rows) {
    if (!latestByProvider[r.provider]) latestByProvider[r.provider] = r;
  }

  return Response.json({
    data: rows,
    latest: {
      freetsa: latestByProvider.freetsa ?? null,
      opentimestamps: latestByProvider.opentimestamps ?? null,
    },
  });
}

async function upsertAnchor(row: {
  orgId: string;
  date: string;
  provider: "freetsa" | "opentimestamps";
  root: string;
  leafCount: number;
  proof: string;
  proofStatus: "complete" | "pending" | "failed";
  lastError?: string;
}) {
  await db
    .insert(auditAnchor)
    .values({
      orgId: row.orgId,
      anchorDate: row.date,
      provider: row.provider,
      merkleRoot: row.root,
      leafCount: row.leafCount,
      proof: row.proof,
      proofStatus: row.proofStatus,
      lastError: row.lastError,
    })
    .onConflictDoUpdate({
      target: [auditAnchor.orgId, auditAnchor.anchorDate, auditAnchor.provider],
      set: {
        merkleRoot: row.root,
        leafCount: row.leafCount,
        proof: row.proof,
        proofStatus: row.proofStatus,
        lastError: row.lastError ?? null,
      },
    });
}
