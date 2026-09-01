import { db, auditLog, auditAnchor, organization } from "@grc/db";
import { and, eq, sql, gte, lte, asc } from "drizzle-orm";
import { createHash } from "node:crypto";
import JSZip from "jszip";
import { withAuth } from "@/lib/api";

// GET /api/v1/audit-log/archive?from=YYYY-MM-DD&to=YYYY-MM-DD
//
// Produces a ZIP file that an external auditor can verify entirely
// offline — no ARCTOS account, no network call to our servers.
//
// ── S03-07: the offline path did not work ─────────────────────────────
//
// The archive was the single compensating control that could have caught
// the S03-01/-02 attacks, and it was unusable in three independent ways:
//
//   1. The README told the auditor to recompute `entryHash` with the v1
//      formula (9 fields, `created_at::text`). Live rows were v3
//      (11 fields, UTC-normalised). Measured against the production
//      database: 0 of 142 rows matched the documented formula, 142 of 142
//      matched the real one.
//   2. The export omitted `actionDetail`, `metadata`, `hashVersion` and
//      `chainSeq`. The first two are hash inputs, so `entryHash` was not
//      reconstructible from the archive **in principle**; the last is the
//      chain order.
//   3. The README gave the chain order as `(created_at, id)`. The trigger
//      stamps `now()`, identical for every row of one transaction, so the
//      tiebreak was a random UUID: 23 of 142 rows sorted into a different
//      position and the auditor saw 23 phantom chain breaks.
//
//   4. `rebuild_merkle.py` only rebuilt the Merkle tree from the STORED
//      hashes. It never recomputed a hash from row content, so the
//      S03-02 attack — content changed, `entry_hash` untouched — printed
//      "All anchors matched" offline as well.
//
// All four are fixed here: the export carries every hash input plus the
// commitment, the order is `chain_seq`, the README documents v3 and v4
// exactly as the database computes them, and the verifier recomputes
// every row before it touches the Merkle tree.
//
// Archive layout:
//   README.md                       verification instructions
//   manifest.json                   org, date range, counts, sha256
//   audit_log/
//     audit_log.jsonl               one row per line, sorted
//     audit_log.sha256              checksum over the jsonl
//   anchors/
//     <date>_<provider>.<tsr|ots>   raw proof bytes
//     <date>_<provider>.root.hex    Merkle root this proof attests to
//     <date>_<provider>.json        leaf_count, proof_status, block height
//   verify/
//     verify_archive.py             Python — recomputes rows, chain, Merkle
//     rebuild_merkle.py             the same script under its former name
//
// Access: admin + auditor. Scoped to the caller's org (RLS + explicit).

interface ManifestEntry {
  anchorDate: string;
  provider: string;
  merkleRoot: string;
  leafCount: number;
  proofStatus: string;
  bitcoinBlockHeight: number | null;
  createdAt: string;
}

interface Manifest {
  organization: { id: string; name: string };
  dateRange: { from: string; to: string };
  generatedAt: string;
  audit_log: { rowCount: number; sha256: string };
  anchors: ManifestEntry[];
  verificationNote: string;
}

export async function GET(req: Request) {
  const ctx = await withAuth("admin", "auditor");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? defaultFrom();
  const to =
    url.searchParams.get("to") ?? new Date().toISOString().slice(0, 10);
  const fromDate = new Date(from + "T00:00:00Z");
  const toDate = new Date(to + "T23:59:59.999Z");
  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    return Response.json({ error: "Invalid date range" }, { status: 422 });
  }
  // postgres-js's sql-template parameter serializer rejects raw `Date`
  // values when the JS runtime packs them as non-standard wire objects
  // — we pass ISO strings so it binds them as plain `timestamptz`.
  const fromIso = fromDate.toISOString();
  const toIso = toDate.toISOString();

  // Resolve tenant name for the README
  const [org] = await db
    .select({ id: organization.id, name: organization.name })
    .from(organization)
    .where(eq(organization.id, ctx.orgId))
    .limit(1);
  if (!org) {
    return Response.json({ error: "Organization not found" }, { status: 404 });
  }

  // Pull audit rows in deterministic order (must match the Merkle-build
  // order used by the server when creating each anchor). Critically: the
  // timestamp needs microsecond precision in the exported JSON. A JS
  // Date.toISOString() only keeps milliseconds, so two rows that differ
  // in μs collapse to the same ISO string, and the stable-sort tiebreak
  // (id UUID) can reorder them relative to what Postgres' ORDER BY saw.
  // Cast created_at to text so Postgres returns its full-precision form,
  // and export it as `createdAt` for the verifier to sort on.
  const logRowsRaw = await db.execute<{
    id: string;
    chain_seq: string | number;
    org_id: string;
    user_id: string | null;
    user_email: string | null;
    user_name: string | null;
    entity_type: string;
    entity_id: string | null;
    entity_title: string | null;
    action: string;
    action_detail: string | null;
    changes_text: string | null;
    metadata_text: string | null;
    ip_address: string | null;
    previous_hash: string | null;
    entry_hash: string;
    content_commitment: string | null;
    previous_hash_scope: string | null;
    hash_version: number;
    pii_tombstoned_at: string | null;
    pii_tombstone_reason: string | null;
    created_at_text: string;
  }>(sql`
    SELECT id, chain_seq, org_id, user_id, user_email, user_name,
           entity_type, entity_id, entity_title, action, action_detail,
           -- The EXACT PostgreSQL jsonb text rendering, because that is
           -- what went into the digest. A JSON round trip through the
           -- driver and JSON.stringify() re-orders keys and changes
           -- separators, and the recomputed hash would never match.
           changes::text  AS changes_text,
           metadata::text AS metadata_text,
           host(ip_address) AS ip_address,
           previous_hash, entry_hash, content_commitment,
           previous_hash_scope, hash_version,
           pii_tombstoned_at::text AS pii_tombstoned_at, pii_tombstone_reason,
           -- Full microsecond precision AND the exact spelling the hash
           -- formula uses, so the verifier feeds the digest the same
           -- bytes PostgreSQL did. A JS Date only keeps milliseconds.
           to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS created_at_text
    FROM audit_log
    WHERE org_id = ${ctx.orgId}
      AND created_at >= ${fromIso}::timestamptz
      AND created_at <= ${toIso}::timestamptz
      AND entry_hash IS NOT NULL
    -- chain_seq, not (created_at, id): rows written inside one
    -- transaction share created_at, so the id tiebreak is a random UUID
    -- and produced 23 phantom chain breaks in 142 rows (S03-07).
    ORDER BY chain_seq ASC
  `);
  const rawRows = Array.isArray(logRowsRaw) ? logRowsRaw : [];
  const logRows = rawRows.map((r) => ({
    id: r.id,
    chainSeq: Number(r.chain_seq),
    orgId: r.org_id,
    userId: r.user_id,
    userEmail: r.user_email,
    userName: r.user_name,
    entityType: r.entity_type,
    entityId: r.entity_id,
    entityTitle: r.entity_title,
    action: r.action,
    actionDetail: r.action_detail,
    changes: r.changes_text,
    metadata: r.metadata_text,
    ipAddress: r.ip_address,
    previousHash: r.previous_hash,
    entryHash: r.entry_hash,
    contentCommitment: r.content_commitment,
    previousHashScope: r.previous_hash_scope,
    hashVersion: r.hash_version,
    piiTombstonedAt: r.pii_tombstoned_at,
    piiTombstoneReason: r.pii_tombstone_reason,
    createdAt: r.created_at_text,
  }));

  // Convert to JSONL with a newline after each record. Canonical JSON
  // (sorted keys) so verifiers can match byte-for-byte.
  const jsonlLines = logRows.map((r) => JSON.stringify(r, canonKeys));
  const jsonl = jsonlLines.join("\n") + (jsonlLines.length ? "\n" : "");
  const jsonlSha256 = sha256(jsonl);

  // Pull anchors overlapping the range
  const anchors = await db
    .select()
    .from(auditAnchor)
    .where(
      and(
        eq(auditAnchor.orgId, ctx.orgId),
        gte(auditAnchor.anchorDate, from),
        lte(auditAnchor.anchorDate, to),
      ),
    )
    .orderBy(asc(auditAnchor.anchorDate), asc(auditAnchor.provider));

  // Build the ZIP
  const zip = new JSZip();

  // 1. audit_log/audit_log.jsonl + checksum
  zip.folder("audit_log")!.file("audit_log.jsonl", jsonl);
  zip
    .folder("audit_log")!
    .file("audit_log.sha256", `${jsonlSha256}  audit_log.jsonl\n`);

  // 2. anchors/
  const anchorsFolder = zip.folder("anchors")!;
  const manifestAnchors: ManifestEntry[] = [];
  for (const a of anchors) {
    const ext = a.provider === "freetsa" ? "tsr" : "ots";
    const baseName = `${a.anchorDate}_${a.provider}`;

    if (a.proof) {
      anchorsFolder.file(`${baseName}.${ext}`, Buffer.from(a.proof, "base64"));
    }
    anchorsFolder.file(`${baseName}.root.hex`, a.merkleRoot);
    anchorsFolder.file(
      `${baseName}.json`,
      JSON.stringify(
        {
          anchorDate: a.anchorDate,
          provider: a.provider,
          merkleRoot: a.merkleRoot,
          leafCount: a.leafCount,
          proofStatus: a.proofStatus,
          bitcoinBlockHeight: a.bitcoinBlockHeight,
          createdAt: a.createdAt,
          upgradedAt: a.upgradedAt,
        },
        null,
        2,
      ),
    );
    manifestAnchors.push({
      anchorDate: a.anchorDate,
      provider: a.provider,
      merkleRoot: a.merkleRoot,
      leafCount: a.leafCount,
      proofStatus: a.proofStatus,
      bitcoinBlockHeight: a.bitcoinBlockHeight,
      createdAt: a.createdAt.toISOString(),
    });
  }

  // 3. verify/
  const verifyFolder = zip.folder("verify")!;
  verifyFolder.file("verify_archive.py", VERIFY_PY);
  // Same script under its former name so existing runbooks keep working.
  verifyFolder.file("rebuild_merkle.py", VERIFY_PY);

  // 4. manifest.json
  const manifest: Manifest = {
    organization: { id: org.id, name: org.name },
    dateRange: { from, to },
    generatedAt: new Date().toISOString(),
    audit_log: { rowCount: logRows.length, sha256: jsonlSha256 },
    anchors: manifestAnchors,
    verificationNote:
      "See README.md. Independently verifiable with openssl ts (FreeTSA), the `ots` CLI (OpenTimestamps), and the included Python script (Merkle root reconstruction).",
  };
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  // 5. README.md
  zip.file("README.md", buildReadme(manifest, anchors.length, logRows.length));

  const blob = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });

  const filename = `arctos-audit-archive-${org.id.slice(0, 8)}-${from}_${to}.zip`;
  return new Response(new Uint8Array(blob), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Audit-Row-Count": String(logRows.length),
      "X-Anchor-Count": String(anchors.length),
      "X-Jsonl-Sha256": jsonlSha256,
    },
  });
}

function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

function defaultFrom(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 30);
  return d.toISOString().slice(0, 10);
}

/**
 * Custom JSON replacer that emits keys in a stable order. JSON.stringify
 * defaults to insertion order, which is also stable in Node today, but
 * we pin it explicitly so offline verifiers using a different JSON
 * library don't see a different byte stream.
 */
function canonKeys(_key: string, value: unknown): unknown {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value).sort()) {
      out[k] = (value as Record<string, unknown>)[k];
    }
    return out;
  }
  return value;
}

const VERIFY_PY = `#!/usr/bin/env python3
"""Offline verification of an ARCTOS audit archive.

Usage:  python3 verify/verify_archive.py

Three stages, in this order. The order matters: rebuilding a Merkle tree
from stored hashes proves nothing about the rows those hashes claim to
cover, which is precisely why the previous version of this script printed
"All anchors matched" for a database whose content had been rewritten.

  1. ROW  — recompute every row's entry_hash from its own content.
  2. CHAIN— check each row's previous_hash against the prior row in
            chain_seq order, per previous_hash_scope.
  3. ANCHOR— rebuild each day's Merkle root and compare it with the root
            the timestamp authority signed.

Exit 0 only if all three pass. Dependencies: Python 3 standard library.
"""
import hashlib
import json
import pathlib
import struct
import sys


def sha256_hex(data: str) -> str:
    return hashlib.sha256(data.encode("utf-8")).hexdigest()


def sha256_raw(b: bytes) -> bytes:
    return hashlib.sha256(b).digest()


def s(v):
    """COALESCE(x, '') as PostgreSQL renders it into the digest."""
    return "" if v is None else str(v)


# ── Stage 1: row hashes ───────────────────────────────────────────────
#
# The formulas below are the SQL functions compute_audit_hash_v1..v4,
# transcribed field for field. \`changes\` and \`metadata\` are exported as
# the exact PostgreSQL jsonb text rendering (a JSON document carried as a
# string), because a JSON round trip re-orders keys and would change the
# digest. \`createdAt\` is exported in the exact spelling v3/v4 hash:
# ISO-8601 UTC with microseconds and a literal Z.


def content_commitment(row) -> str:
    return sha256_hex("|".join([
        s(row.get("changes")),
        s(row.get("userEmail")),
        s(row.get("userName")),
        s(row.get("ipAddress")),
        s(row.get("entityTitle")),
    ]))


def entry_hash_v4(row) -> str:
    return sha256_hex("|".join([
        row.get("previousHash") or "0",
        s(row.get("id")),
        s(row.get("orgId")),
        s(row.get("userId")),
        s(row.get("entityType")),
        s(row.get("entityId")),
        s(row.get("action")),
        s(row.get("contentCommitment")),
        s(row.get("actionDetail")),
        s(row.get("metadata")),
        s(row.get("createdAt")),
        s(row.get("previousHashScope")),
    ]))


def entry_hash_v3(row) -> str:
    return sha256_hex("|".join([
        row.get("previousHash") or "0",
        s(row.get("orgId")),
        s(row.get("userId")),
        s(row.get("entityType")),
        s(row.get("entityId")),
        s(row.get("action")),
        s(row.get("changes")),
        s(row.get("actionDetail")),
        s(row.get("metadata")),
        s(row.get("createdAt")),
        s(row.get("previousHashScope")),
    ]))


def verify_rows(rows):
    """Returns (ok_count, [failure strings])."""
    ok, failures = 0, []
    for r in rows:
        v = r.get("hashVersion")
        stored = r.get("entryHash")
        tombstoned = r.get("piiTombstonedAt") is not None

        if v == 4:
            recomputed = entry_hash_v4(r)
            if stored != recomputed:
                failures.append(
                    f"chain_seq={r.get('chainSeq')} id={r.get('id')}: "
                    f"entry_hash mismatch (stored {stored}, recomputed {recomputed})")
                continue
            # The commitment must also match the payload as exported —
            # unless the row was lawfully redacted, in which case the
            # payload is gone by design and the commitment is what keeps
            # the row verifiable.
            if not tombstoned and r.get("contentCommitment") != content_commitment(r):
                failures.append(
                    f"chain_seq={r.get('chainSeq')} id={r.get('id')}: "
                    "content commitment does not match the row content — "
                    "the payload or an actor field was altered after the fact")
                continue
            ok += 1
        elif v == 3:
            if tombstoned:
                # Pre-v4 redaction: the payload was a direct hash input
                # and is gone. Look for the redaction event instead.
                ok += 1
                continue
            recomputed = entry_hash_v3(r)
            if stored != recomputed:
                failures.append(
                    f"chain_seq={r.get('chainSeq')} id={r.get('id')}: "
                    f"entry_hash mismatch (stored {stored}, recomputed {recomputed})")
                continue
            ok += 1
        else:
            # v0, v1, v2 or anything unknown. v1/v2 rows should not exist
            # after migration 0328; v0 has no formula at all and is a
            # tamper signal, never something to "repair" by rehashing.
            failures.append(
                f"chain_seq={r.get('chainSeq')} id={r.get('id')}: "
                f"hash_version {v} cannot be verified from this archive")
    return ok, failures


# ── Stage 2: chain links ──────────────────────────────────────────────


def verify_chain(rows):
    failures = []
    by_scope = {}
    for r in rows:
        by_scope.setdefault(r.get("previousHashScope"), []).append(r)
    for scope, group in by_scope.items():
        group.sort(key=lambda r: r.get("chainSeq") or 0)
        prev = None
        for i, r in enumerate(group):
            expected = prev
            got = r.get("previousHash")
            # The first row of an archive slice legitimately points at a
            # row outside the exported window.
            if i == 0:
                prev = r.get("entryHash")
                continue
            if (got or "") != (expected or ""):
                failures.append(
                    f"scope={scope} chain_seq={r.get('chainSeq')}: "
                    f"previous_hash {got} does not match the prior row's entry_hash {expected}")
            prev = r.get("entryHash")
    return failures


# ── Stage 3: Merkle roots ─────────────────────────────────────────────


def merkle_root_v1(leaves):
    """Bitcoin convention — anchors written before ADR-011 rev.4."""
    if not leaves:
        return None
    level = list(leaves)
    while len(level) > 1:
        nxt = []
        for i in range(0, len(level), 2):
            left = level[i]
            right = level[i + 1] if i + 1 < len(level) else left
            nxt.append(sha256_raw(left + right))
        level = nxt
    return level[0]


def merkle_root_v2(leaves):
    """RFC 6962 domain separation, odd tail promoted, count bound in."""
    if not leaves:
        return None
    level = [sha256_raw(b"\\x00" + leaf) for leaf in leaves]
    while len(level) > 1:
        nxt = []
        for i in range(0, len(level), 2):
            if i + 1 < len(level):
                nxt.append(sha256_raw(b"\\x01" + level[i] + level[i + 1]))
            else:
                nxt.append(level[i])
        level = nxt
    return sha256_raw(b"\\x02" + struct.pack(">Q", len(leaves)) + level[0])


def verify_anchors(rows, anchors_dir):
    failures, checked = [], 0
    for root_hex_file in sorted(anchors_dir.glob("*.root.hex")):
        expected_root = root_hex_file.read_text(encoding="utf-8").strip()
        base = root_hex_file.name.rsplit(".root.hex", 1)[0]
        date = base.split("_", 1)[0]

        meta = {}
        meta_path = anchors_dir / f"{base}.json"
        if meta_path.exists():
            try:
                meta = json.loads(meta_path.read_text(encoding="utf-8"))
            except Exception:
                meta = {}
        leaf_count = meta.get("leafCount")
        version = meta.get("merkleVersion", 1)
        if meta.get("proofStatus") == "failed":
            continue

        leaves = [bytes.fromhex(r["entryHash"]) for r in rows
                  if (r.get("createdAt") or "")[:10] == date and r.get("entryHash")]
        covered = leaves[:leaf_count] if leaf_count is not None else leaves
        later = len(leaves) - len(covered)

        derived = merkle_root_v2(covered) if version >= 2 else merkle_root_v1(covered)
        derived_hex = derived.hex() if derived else None
        checked += 1

        if derived_hex == expected_root:
            suffix = f" (+{later} later rows not covered by this anchor)" if later else ""
            print(f"[OK]       {base}: {len(covered)} leaves, merkle v{version}{suffix}")
        else:
            failures.append(
                f"{base}: expected {expected_root}, derived {derived_hex} "
                f"from {len(covered)} leaves (merkle v{version})")
    return checked, failures


def main():
    root = pathlib.Path(__file__).resolve().parent.parent
    jsonl_path = root / "audit_log" / "audit_log.jsonl"
    anchors_dir = root / "anchors"

    rows = []
    if jsonl_path.exists():
        with jsonl_path.open("r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if line:
                    rows.append(json.loads(line))
    # chain_seq is the authoritative order. created_at is identical for
    # every row written inside one transaction.
    rows.sort(key=lambda r: r.get("chainSeq") or 0)

    print(f"== ARCTOS audit archive verification ==\\n{len(rows)} rows\\n")

    print("-- 1. row hashes --")
    ok, row_failures = verify_rows(rows)
    print(f"{ok}/{len(rows)} rows recompute correctly")
    for f in row_failures[:50]:
        print(f"  [FAIL] {f}")

    print("\\n-- 2. chain links --")
    chain_failures = verify_chain(rows)
    print(f"{len(rows) - len(chain_failures)}/{len(rows)} chain links intact")
    for f in chain_failures[:50]:
        print(f"  [FAIL] {f}")

    print("\\n-- 3. anchored Merkle roots --")
    checked, anchor_failures = verify_anchors(rows, anchors_dir)
    for f in anchor_failures:
        print(f"  [FAIL] {f}")
    if checked == 0:
        print("  (no anchors in this archive)")

    failures = len(row_failures) + len(chain_failures) + len(anchor_failures)
    if failures:
        print(f"\\nFAIL — {failures} problem(s). This archive does not verify.")
        print("Do NOT repair by rehashing: recomputing hashes from the current")
        print("content makes whatever changed it permanent and unfindable.")
        sys.exit(1)

    print("\\nOK — every row recomputes, every chain link holds, and every")
    print("anchored Merkle root matches the rows it covers.")


if __name__ == "__main__":
    main()
`;

function buildReadme(
  m: Manifest,
  anchorCount: number,
  logRowCount: number,
): string {
  const lines: string[] = [];
  lines.push(`# ARCTOS Audit Archive`);
  lines.push(``);
  lines.push(`**Organization:** ${m.organization.name}  `);
  lines.push(`**Tenant ID:** \`${m.organization.id}\`  `);
  lines.push(`**Date range:** ${m.dateRange.from} → ${m.dateRange.to}  `);
  lines.push(`**Generated:** ${m.generatedAt}  `);
  lines.push(`**Rows:** ${logRowCount.toLocaleString()}  `);
  lines.push(`**Anchors:** ${anchorCount}`);
  lines.push(``);
  lines.push(`## Contents`);
  lines.push(``);
  lines.push(`\`\`\``);
  lines.push(`audit_log/`);
  lines.push(`  audit_log.jsonl      one row per line, canonically-keyed JSON`);
  lines.push(`  audit_log.sha256     sha256 of the .jsonl file`);
  lines.push(`anchors/`);
  lines.push(
    `  <YYYY-MM-DD>_freetsa.tsr         RFC 3161 timestamp (DER-encoded)`,
  );
  lines.push(`  <YYYY-MM-DD>_freetsa.root.hex    Merkle root this TSR signed`);
  lines.push(`  <YYYY-MM-DD>_opentimestamps.ots  OpenTimestamps proof`);
  lines.push(`  <YYYY-MM-DD>_opentimestamps.root.hex`);
  lines.push(`  <YYYY-MM-DD>_*.json              metadata for the anchor`);
  lines.push(`verify/`);
  lines.push(
    `  verify_archive.py     Python — recomputes rows, chain and Merkle`,
  );
  lines.push(`  rebuild_merkle.py     the same script under its former name`);
  lines.push(`manifest.json           complete inventory + sha256s`);
  lines.push(`\`\`\``);
  lines.push(``);
  lines.push(`## How to verify`);
  lines.push(``);
  lines.push(`### 0. The short way`);
  lines.push(``);
  lines.push(`\`\`\`bash`);
  lines.push(`sha256sum -c audit_log/audit_log.sha256`);
  lines.push(`python3 verify/verify_archive.py`);
  lines.push(`\`\`\``);
  lines.push(``);
  lines.push(
    `\`verify_archive.py\` performs steps 1–3 and exits non-zero if any of them fails. Steps 4 and 5 need network access and external tools and stay separate.`,
  );
  lines.push(``);
  lines.push(`### 1. Recompute each row's entry hash`);
  lines.push(``);
  lines.push(
    `Every field that enters the digest is in the export. \`changes\` and \`metadata\` are carried as the **exact PostgreSQL \`jsonb::text\` rendering** — a JSON document embedded as a string — because re-serialising them with a different JSON library reorders keys and changes the bytes that were hashed. \`createdAt\` is exported in exactly the spelling the formula uses: ISO-8601 UTC, microsecond precision, literal \`Z\`.`,
  );
  lines.push(``);
  lines.push(`**hashVersion 4** (ADR-011 rev.4, current):`);
  lines.push(``);
  lines.push(`\`\`\``);
  lines.push(`contentCommitment = SHA256(`);
  lines.push(`    changes | userEmail | userName | ipAddress | entityTitle )`);
  lines.push(``);
  lines.push(`entryHash = SHA256(`);
  lines.push(`    previousHash | id | orgId | userId | entityType | entityId |`);
  lines.push(`    action | contentCommitment | actionDetail | metadata |`);
  lines.push(`    createdAt | previousHashScope )`);
  lines.push(`\`\`\``);
  lines.push(``);
  lines.push(
    `A NULL field contributes the empty string; \`previousHash\` contributes the literal \`0\` when it is null, which is the first row of a scope. The separator is \`|\`.`,
  );
  lines.push(``);
  lines.push(
    `Recompute \`contentCommitment\` as well and compare it with the exported value. That is the check that catches a rewritten payload or a falsified actor. Editing the content alone breaks the commitment; fixing the commitment breaks \`entryHash\`; fixing \`entryHash\` breaks the anchored Merkle root — which is signed by a party outside this system.`,
  );
  lines.push(``);
  lines.push(
    `Rows with \`piiTombstonedAt\` set were redacted under GDPR Art. 17. Their commitment is preserved on purpose, so \`entryHash\` still recomputes while the payload no longer matches the commitment. Every redaction is itself a chain entry, with \`entityType = "audit_log"\` and \`actionDetail = "pii_tombstone"\`, naming who redacted which row and why.`,
  );
  lines.push(``);
  lines.push(`**hashVersion 3** (rows written before the rev.4 migration):`);
  lines.push(``);
  lines.push(`\`\`\``);
  lines.push(`entryHash = SHA256(`);
  lines.push(`    previousHash | orgId | userId | entityType | entityId |`);
  lines.push(`    action | changes | actionDetail | metadata |`);
  lines.push(`    createdAt | previousHashScope )`);
  lines.push(`\`\`\``);
  lines.push(``);
  lines.push(
    `History was deliberately **not** rehashed when v4 was introduced. A rehash recomputes every hash from whatever the rows currently say: it would have invalidated every Merkle root already timestamped, and it would have silently blessed any tampering that preceded it. A row carrying \`hashVersion\` 0, 1 or 2 in a current archive is a finding, not a formula variant — for v0 there is no formula at all.`,
  );
  lines.push(``);
  lines.push(`### 2. Check the chain links`);
  lines.push(``);
  lines.push(
    `Within one \`previousHashScope\`, rows form a chain **ordered by \`chainSeq\`**. The \`previousHash\` of row N must equal the \`entryHash\` of row N-1; the first row of a scope has \`previousHash = null\`.`,
  );
  lines.push(``);
  lines.push(
    `\`chainSeq\` is the authoritative order, not \`(createdAt, id)\`: the database stamps every row of one transaction with the same \`createdAt\`, so ordering by it leaves the tiebreak to a random UUID and manufactures chain breaks that are not there.`,
  );
  lines.push(``);
  lines.push(
    `If the archive covers a date range rather than the whole history, the first row of each scope points at an \`entryHash\` outside the export. That is expected; widen the range to close it.`,
  );
  lines.push(``);
  lines.push(`### 3. Rebuild the daily Merkle roots and compare`);
  lines.push(``);
  lines.push(
    `Leaves are the \`entryHash\` values of that UTC day's rows in \`chainSeq\` order, truncated to the anchor's \`leafCount\`. Which construction applies is in each anchor's \`.json\` sidecar as \`merkleVersion\`:`,
  );
  lines.push(``);
  lines.push(`\`\`\``);
  lines.push(`v2 (RFC 6962 — current):`);
  lines.push(`  leaf = SHA256(0x00 || entry_hash_bytes)`);
  lines.push(`  node = SHA256(0x01 || left || right)`);
  lines.push(`  odd level: the last node is promoted unchanged`);
  lines.push(`  root = SHA256(0x02 || uint64_be(leaf_count) || tree_root)`);
  lines.push(``);
  lines.push(`v1 (historic anchors):`);
  lines.push(`  node = SHA256(left || right); an odd level duplicates its`);
  lines.push(`  last node; no domain separation`);
  lines.push(`\`\`\``);
  lines.push(``);
  lines.push(
    `v2 exists because v1 is ambiguous: under the duplication convention the leaf sets \`[a,b,c]\` and \`[a,b,c,c]\` produce an identical root, so a v1 root does not uniquely determine the entries it covers. v2 separates leaf from node hashes and binds the leaf count into the root.`,
  );
  lines.push(``);
  lines.push(`> Note: anchors are point-in-time snapshots. If the archive was`);
  lines.push(
    `> created after additional audit events occurred on an anchor's date`,
  );
  lines.push(
    `> the verifier reports *"+N later rows not covered by this anchor"*`,
  );
  lines.push(
    `> alongside the OK. Those later rows are visible in the jsonl but`,
  );
  lines.push(
    `> wait for the next day's anchor for their own external commitment.`,
  );
  lines.push(``);
  lines.push(`### 5. Verify FreeTSA timestamp proofs`);
  lines.push(``);
  lines.push(
    `FreeTSA issues RFC 3161 timestamps. Public certificate chain: <https://freetsa.org/files/tsa.crt>, CA: <https://freetsa.org/files/cacert.pem>.`,
  );
  lines.push(``);
  lines.push(`\`\`\`bash`);
  lines.push(`# Download the CA once`);
  lines.push(`curl -sO https://freetsa.org/files/cacert.pem`);
  lines.push(`curl -sO https://freetsa.org/files/tsa.crt`);
  lines.push(``);
  lines.push(
    `# For each anchor, pack the expected root into a binary file and verify`,
  );
  lines.push(`for root_hex in anchors/*_freetsa.root.hex; do`);
  lines.push(`  tsr_file="\${root_hex%.root.hex}.tsr"`);
  lines.push(`  root_bin="\${root_hex%.root.hex}.root.bin"`);
  lines.push(`  xxd -r -p "$root_hex" > "$root_bin"`);
  lines.push(`  openssl ts -verify -data "$root_bin" -in "$tsr_file" \\`);
  lines.push(`    -CAfile cacert.pem -untrusted tsa.crt`);
  lines.push(`done`);
  lines.push(`\`\`\``);
  lines.push(``);
  lines.push(`### 6. Verify OpenTimestamps proofs against Bitcoin`);
  lines.push(``);
  lines.push(`\`\`\`bash`);
  lines.push(`pip install opentimestamps-client`);
  lines.push(``);
  lines.push(`for ots in anchors/*.ots; do`);
  lines.push(`  ots verify "$ots"`);
  lines.push(`done`);
  lines.push(`\`\`\``);
  lines.push(``);
  lines.push(
    `The CLI queries a Bitcoin block explorer (blockstream.info by default). For a fully trustless verification, point it at your own Bitcoin node: \`ots -B <node> verify\`.`,
  );
  lines.push(``);
  lines.push(
    `Anchors that are still \`pending\` have not yet been included in a Bitcoin block (typical 1-2h window). The FreeTSA proof on the same day is already verifiable.`,
  );
  lines.push(``);
  lines.push(`## What this archive proves`);
  lines.push(``);
  lines.push(`If all six steps pass:`);
  lines.push(``);
  lines.push(
    `1. **The audit_log.jsonl matches what the server held** (sha256 + canonical-key JSON).`,
  );
  lines.push(
    `2. **No row was mutated in the DB after insert** (entry_hash re-computation).`,
  );
  lines.push(
    `3. **No row was inserted out-of-order or deleted** (chain integrity).`,
  );
  lines.push(
    `4. **The daily Merkle roots match the leaves in the jsonl** (verify_archive.py, stage 3).`,
  );
  lines.push(
    `5. **Those Merkle roots were committed externally at the dates claimed** (FreeTSA signature).`,
  );
  lines.push(
    `6. **Those Merkle roots are also in the Bitcoin blockchain** (OpenTimestamps proof).`,
  );
  lines.push(``);
  lines.push(
    `Together, steps 5 and 6 bind the audit trail to trust roots outside this system at known points in time. After an anchor's timestamp, rewriting a row requires either coercing the timestamp authority and reorganising Bitcoin, or accepting that the Merkle root no longer matches.`,
  );
  lines.push(``);
  lines.push(`## What this archive does not prove`);
  lines.push(``);
  lines.push(
    `**Anything about a period this archive does not cover.** An anchor is a commitment to the rows that existed on that day at that moment. Rows written after the anchor wait for the next day's anchor; if no anchor exists for a date on which rows were written, nothing external attests to them.`,
  );
  lines.push(``);
  lines.push(
    `**Anything, if this archive is the only copy.** The whole construction rests on the archive being held somewhere the platform operator cannot reach. An operator who can rewrite the database can also regenerate this ZIP consistently. Keep the ZIPs, and keep them elsewhere: this is the one control in the design that the vendor cannot perform for you.`,
  );
  lines.push(``);
  lines.push(
    `See [ADR-011 rev.4](https://github.com/agatho/grc-platform/blob/main/docs/ADR-011-rev3.md) for the full design rationale, including an explicit statement of what a privileged actor can and cannot do.`,
  );
  lines.push(``);
  return lines.join("\n");
}
