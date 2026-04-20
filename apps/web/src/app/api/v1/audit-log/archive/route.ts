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
//     rebuild_merkle.py             Python — rebuilds Merkle from jsonl
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
    org_id: string;
    user_id: string | null;
    user_email: string | null;
    user_name: string | null;
    entity_type: string;
    entity_id: string | null;
    entity_title: string | null;
    action: string;
    changes: unknown;
    previous_hash: string | null;
    entry_hash: string;
    previous_hash_scope: string | null;
    created_at_text: string;
  }>(sql`
    SELECT id, org_id, user_id, user_email, user_name,
           entity_type, entity_id, entity_title, action, changes,
           previous_hash, entry_hash, previous_hash_scope,
           created_at::text AS created_at_text
    FROM audit_log
    WHERE org_id = ${ctx.orgId}
      AND created_at >= ${fromIso}::timestamptz
      AND created_at <= ${toIso}::timestamptz
      AND entry_hash IS NOT NULL
    ORDER BY created_at ASC, id ASC
  `);
  const rawRows = Array.isArray(logRowsRaw) ? logRowsRaw : [];
  const logRows = rawRows.map((r) => ({
    id: r.id,
    orgId: r.org_id,
    userId: r.user_id,
    userEmail: r.user_email,
    userName: r.user_name,
    entityType: r.entity_type,
    entityId: r.entity_id,
    entityTitle: r.entity_title,
    action: r.action,
    changes: r.changes,
    previousHash: r.previous_hash,
    entryHash: r.entry_hash,
    previousHashScope: r.previous_hash_scope,
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
  zip.folder("verify")!.file("rebuild_merkle.py", VERIFY_PY);

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
"""Rebuild the Merkle root from audit_log.jsonl and compare against each
anchor's stored root.

Usage:  python3 verify/rebuild_merkle.py

Exits 0 if every anchor's Merkle root matches what we derive from the
audit_log rows it covered. Exits 1 otherwise.

Dependencies: only Python 3 standard library.
"""
import hashlib
import json
import os
import pathlib
import sys


def sha256_raw(b):
    h = hashlib.sha256()
    h.update(b)
    return h.digest()


def merkle_root(leaves):
    """leaves: list of 32-byte bytes objects. Returns 32-byte root or None if empty."""
    if not leaves:
        return None
    level = list(leaves)
    while len(level) > 1:
        nxt = []
        for i in range(0, len(level), 2):
            left = level[i]
            right = level[i + 1] if i + 1 < len(level) else left  # promote odd
            nxt.append(sha256_raw(left + right))
        level = nxt
    return level[0]


def main():
    root = pathlib.Path(__file__).resolve().parent.parent
    jsonl_path = root / "audit_log" / "audit_log.jsonl"
    anchors_dir = root / "anchors"

    # Load + sort audit rows by (createdAt, id) — same order the
    # server used when building the anchors.
    rows = []
    if jsonl_path.exists():
        with jsonl_path.open("r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                rows.append(json.loads(line))
    rows.sort(key=lambda r: (r.get("createdAt") or "", r.get("id") or ""))

    ok = True
    for root_hex_file in sorted(anchors_dir.glob("*.root.hex")):
        expected_root = root_hex_file.read_text(encoding="utf-8").strip()
        base = root_hex_file.name.rsplit(".root.hex", 1)[0]
        date = base.split("_", 1)[0]

        # The anchor was taken at a specific moment with a specific row count.
        # Rows added to the DB AFTER that moment are in the archive but not
        # covered by the anchor. Read leaf_count from the .json sidecar so
        # the verifier reconstructs the exact tree the server built.
        meta_path = anchors_dir / f"{base}.json"
        anchor_leaf_count = None
        if meta_path.exists():
            try:
                meta = json.loads(meta_path.read_text(encoding="utf-8"))
                anchor_leaf_count = meta.get("leafCount")
            except Exception:
                pass

        # Leaves = entry_hash of rows whose created_at date matches, in
        # chronological order. If leafCount is known, take only the first N.
        leaves = []
        for r in rows:
            created = r.get("createdAt", "")
            # createdAt is ISO-8601 with Z or offset; first 10 chars is the date
            if created[:10] == date and r.get("entryHash"):
                leaves.append(bytes.fromhex(r["entryHash"]))

        anchored_leaves = leaves[:anchor_leaf_count] if anchor_leaf_count is not None else leaves
        unanchored_count = len(leaves) - len(anchored_leaves)

        derived = merkle_root(anchored_leaves)
        derived_hex = derived.hex() if derived else None

        status = "OK" if derived_hex == expected_root else "MISMATCH"
        if status != "OK":
            ok = False
        suffix = f" (+{unanchored_count} later rows not covered by this anchor)" if unanchored_count else ""
        print(f"[{status}] {base}")
        print(f"   expected: {expected_root}")
        print(f"   derived:  {derived_hex} ({len(anchored_leaves)} leaves{suffix})")

    if not ok:
        print("\\nFAIL — at least one anchor's Merkle root did not match.")
        sys.exit(1)
    print("\\nAll anchors matched — the audit_log.jsonl is consistent with the stored Merkle roots.")


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
  lines.push(`  rebuild_merkle.py     Python — reconstructs the Merkle root`);
  lines.push(`manifest.json           complete inventory + sha256s`);
  lines.push(`\`\`\``);
  lines.push(``);
  lines.push(`## How to verify`);
  lines.push(``);
  lines.push(`### 1. Check that the audit log hasn't been altered`);
  lines.push(``);
  lines.push(`\`\`\`bash`);
  lines.push(`sha256sum -c audit_log/audit_log.sha256`);
  lines.push(`\`\`\``);
  lines.push(``);
  lines.push(
    `### 2. Check that each row's entry_hash is internally consistent`,
  );
  lines.push(``);
  lines.push(`Each row's \`entryHash\` is SHA-256 over:`);
  lines.push(``);
  lines.push(`\`\`\``);
  lines.push(`previous_hash | org_id | user_id | entity_type | entity_id |`);
  lines.push(`action | changes_json | created_at | previous_hash_scope`);
  lines.push(`\`\`\``);
  lines.push(``);
  lines.push(
    `(PostgreSQL \`text\` concatenation with \`|\` separator, as emitted by \`audit_trigger()\`. See ADR-011 rev.2.)`,
  );
  lines.push(``);
  lines.push(
    `### 3. Check that each row's previous_hash chains to the prior row`,
  );
  lines.push(``);
  lines.push(
    `Within a \`previous_hash_scope\`, rows form a chain sorted by \`(created_at, id)\`. The \`previousHash\` of row N must equal the \`entryHash\` of row N-1. The first row in the scope has \`previousHash = null\`.`,
  );
  lines.push(``);
  lines.push(`### 4. Rebuild the daily Merkle roots and compare`);
  lines.push(``);
  lines.push(`\`\`\`bash`);
  lines.push(`python3 verify/rebuild_merkle.py`);
  lines.push(`\`\`\``);
  lines.push(``);
  lines.push(
    `Prints OK or MISMATCH for each anchor. Exits non-zero if anything fails.`,
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
    `4. **The daily Merkle roots match the leaves in the jsonl** (rebuild_merkle.py).`,
  );
  lines.push(
    `5. **Those Merkle roots were committed externally at the dates claimed** (FreeTSA signature).`,
  );
  lines.push(
    `6. **Those Merkle roots are also in the Bitcoin blockchain** (OpenTimestamps proof).`,
  );
  lines.push(``);
  lines.push(
    `Together, steps 5 and 6 bind the entire audit trail to an external trust root at known points in time. After the anchor timestamp, rewriting any row would require either coercing FreeTSA AND reorganizing Bitcoin, or the shorter path of accepting that the Merkle root would no longer match.`,
  );
  lines.push(``);
  lines.push(
    `See [ADR-011 rev.3](https://github.com/agatho/grc-platform/blob/main/docs/ADR-011-rev3.md) for the full design rationale.`,
  );
  lines.push(``);
  return lines.join("\n");
}
