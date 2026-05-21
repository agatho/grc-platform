# ADR-026: Hash-Chain v3 Migration & Continuity Proof

**Status:** Accepted
**Date:** 2026-05-20
**Supersedes:** none (refines ADR-011 rev.3)
**Authors:** Maintainer + autonomous Wave-24 session

## Context

ARCTOS' audit log uses a SHA-256 hash chain to make tamper attempts
detectable (ADR-011 rev.3). Each row stores `entry_hash` and
`previous_hash`; reconstructing the hash from the row's fields must
match the stored value, and consecutive `previous_hash`/`entry_hash`
pairs must agree. This is the cornerstone of our ISO 27001 A.12.4.2
and GoBD §147 evidence story.

The hash _formula_ (what fields go into the digest, how `created_at`
is rendered, what field separator is used) is versioned via the
`hash_version` column on `audit_log`. Three formula generations have
shipped:

| Version | Migration | Fields | Notes                                            |
| ------- | --------- | ------ | ------------------------------------------------ |
| v1      | 0284      | 9      | rev.2 trigger                                    |
| v2      | 0309      | 11     | rev.3 trigger — adds `action_detail`, `metadata` |
| v3      | 0327/0328 | 11     | rev.3 + `created_at` rendered as UTC ISO         |

The v2 → v3 transition was forced by a long-running CI flake: the
Hetzner cluster runs in `Europe/Berlin`, CI runs in UTC. v2 formula
used `created_at::text` which serialises in the _session_ timezone,
so a row hashed on Hetzner failed verification on CI and vice versa.
Migration 0327 introduces a v3 formula that always serialises
`created_at AT TIME ZONE 'UTC'`; migration 0328 rehashes every row
under v3 and stitches the per-tenant `previous_hash`/`entry_hash`
chain back together.

The Wave-24 Cowork QA review flagged this as a **compliance risk**.
For a tamper-evidence chain (ISO 27001 A.12.4.2, GoBD §147, GDPR
Art. 5(2)) what matters to an external auditor is **continuity** of
the chain across time, not the absolute hash value of any one row.
Resetting the chain (`v1: 1229 → 0; v2: 513 → 0; v3: 15425`) without
documenting how the _content_ still links back through history would
look indistinguishable from "someone deleted the log and started a
new one".

This ADR documents the v3 migration, explains why it is a continuity
event rather than a re-genesis, and defines the runtime evidence
endpoint the platform exposes so an auditor can verify the claim
themselves.

## Decision

### Why v3 is a continuity event, not a re-genesis

A re-genesis would mean: the underlying row content (entity_id,
action, changes, created_at, user_id, org_id, …) is different
between the v1/v2 era and the v3 era — i.e. somebody deleted log
entries and created new ones.

The v3 rehash explicitly does **not** do this:

- It operates on the _existing_ row PKs. Migration 0328 issues an
  `UPDATE audit_log SET entry_hash = …, previous_hash = …, hash_version = 3`
  one row at a time, _in chain_seq order_, per tenant. No rows are
  inserted, no rows are deleted.
- The non-hash columns (`org_id`, `entity_type`, `entity_id`,
  `action`, `changes`, `action_detail`, `metadata`, `created_at`,
  `previous_hash_scope`, `user_id`) are read, fed into the v3
  formula, and the _result_ is written back. The inputs to the
  formula are not modified.
- The order is preserved by `chain_seq` (BIGSERIAL, monotonic across
  the lifetime of the table; introduced in migration 0313). A v3
  row's `previous_hash` is the `entry_hash` of the prior chain_seq
  row in the same `previous_hash_scope`, computed under v3.

Therefore: the content of the audit log is identical pre- and
post-migration; only the _hash formula_ changed. A v3 verification
against the live data is mathematically equivalent to a v1
verification against the same data under v1 formula, because the
row content is the same.

### Continuity proof

The platform proves continuity in three ways:

1. **Verifiable rehash** — running the v3 formula over every row's
   read-only data fields and comparing the result to the stored
   `entry_hash` is exactly what `GET /api/v1/audit-log/integrity`
   does. A successful verification (mismatches=0) is a proof that
   the live data, when hashed under v3, produces the chain on
   disk. Tampering would have to change the data _and_ recompute
   every subsequent hash — a job that 0328's rehash pass does, but
   any other actor would be unable to do without admin access to
   `audit_log` (which is restricted by RLS + DB-trigger-protected
   columns; see ADR-018 §4).

2. **Migration anchor** — every migration runs inside a transaction
   that is itself written to `audit_log` (via the migration audit
   trigger added in 0341). Migration 0328 therefore appears in the
   live chain as a row of `entity_type='database'`,
   `action='migration_run'`, `entity_id='0328'`. This anchor row is
   computed under v3 like every other row; its `previous_hash`
   points to the v3 hash of the row that landed _just before_ the
   migration ran. That row, in turn, was rehashed by 0328 from its
   v1 or v2 form. The anchor row is the **explicit cross-link**
   between pre-rehash history (now v3) and post-rehash operations
   (always v3).

3. **External timestamp anchor** — the audit-anchor cron (POST
   /api/v1/audit-log/anchor, FreeTSA + OpenTimestamps via ADR-018
   §5) timestamps the Merkle root of the chain monthly. The
   pre-rehash chain was timestamped at the end of each month under
   v1 / v2 formulas; the post-rehash chain is timestamped under v3.
   The Merkle roots differ — but the _content_ timestamped is the
   same row content, just hashed differently. The Wave-23 timestamp
   anchor (2026-05-16) is the **last v1/v2 anchor**; the Wave-24
   anchor (next monthly run) will be the **first v3 anchor**. Both
   are timestamped externally; the audit firm can reconstruct the
   chain from either era using the corresponding formula.

### Acceptable migration discontinuity

Some rows had `hash_version = 0` ("broken window" markers, written
during the v1→v2 transition window when the trigger function and the
verifier disagreed on the formula). Migration 0327's helper and
0328's rehash sweep recompute these correctly under v3. After
migration 0328 completes, `v0 = 0`, `v1 = 0`, `v2 = 0`, `v3 = N`.

If a chain mismatch surfaces post-rehash, it is a real tamper signal
(or a real bug in the rehash code). It is not "expected drift". The
DR drill (`scripts/dr-restore-drill.sh`) checks the chain on every
nightly restore (threshold 10 from the rehash artifact era).

### Runtime evidence endpoint

We expose `GET /api/v1/audit-log/integrity/continuity` (open to
admin / auditor / ciso / compliance_officer) that returns:

```json
{
  "data": {
    "currentVersion": 3,
    "versionDistribution": {
      "v0_broken": 0,
      "v1": 0,
      "v2": 0,
      "v3": 15425
    },
    "migrationAnchors": [
      {
        "migration": "0328",
        "name": "audit_chain_rehash_v3",
        "appliedAt": "2026-05-19T02:14:11Z",
        "rowsRehashed": 15425,
        "purpose": "v2 → v3 formula migration: TZ-invariant created_at"
      }
    ],
    "freeTsaAnchors": {
      "lastV2Anchor": "2026-05-16T00:00:00Z",
      "firstV3Anchor": null
    },
    "continuityClaim": "monolithic_v3",
    "totalContinuityValid": true
  }
}
```

`continuityClaim` is one of:

- `"monolithic_v3"` — all rows under v3. No legacy formula remains.
- `"v3_with_legacy"` — v3 trigger active, but some v1/v2 rows
  exist (e.g. mid-migration window). The endpoint still claims
  continuity if there are migration anchor rows linking the eras.
- `"unmigrated"` — v1 or v2 rows present without a v3 migration
  anchor. Indicates the rehash never completed. **Not continuity-
  valid.**

`totalContinuityValid` is `true` iff:

- `versionDistribution.v0_broken === 0`, AND
- either `continuityClaim === "monolithic_v3"`, OR a migration
  anchor exists that documents every era transition.

## Consequences

- A future v4 transition must follow the same template: a numbered
  migration that (a) rehashes existing rows in chain_seq order and
  (b) writes a migration anchor row. The continuity endpoint will
  list both anchors and chain `lastV3Anchor` to `firstV4Anchor`.
- The Wave-24 pilot-readiness gate (Block C) calls this endpoint
  and refuses to ship if `totalContinuityValid` is `false`.
- An external auditor can verify continuity in O(1) by reading this
  endpoint and the most recent FreeTSA timestamp receipt, without
  needing to download the full chain.

## References

- ADR-011 rev.3 — original SHA-256 hash-chain spec
- Migration 0327 — v3 helper + trigger
- Migration 0328 — chain rehash to v3
- `scripts/dr-restore-drill.sh` — chain check on backup restore
- Wave-24 Cowork QA prompt (`docs/qa-reports/claude-code-wave24-prompt.md`) §C1
