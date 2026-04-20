-- Migration 0285: Audit-chain external anchor (ADR-011 rev.3)
--
-- Adds a table that records daily tamper-evident anchors of the per-tenant
-- audit_log chain to external trust roots. Two providers are supported
-- simultaneously:
--
--  1. FreeTSA (RFC 3161) — millisecond-latency timestamp signed by a
--     public timestamp authority. Cheap to verify, trusts one server.
--
--  2. OpenTimestamps — ~1-2h-latency proof aggregated into a Bitcoin
--     transaction via community calendar servers. Unforgeable without
--     controlling the Bitcoin PoW majority.
--
-- The pattern is "one anchor row per (tenant, day, provider)". A nightly
-- worker (apps/worker/src/crons/daily-audit-anchor.ts) builds a Merkle
-- tree over that day's audit_log rows for one tenant, sends the root to
-- both providers, stores the resulting proofs here. Verification happens
-- on-demand: the integrity endpoint rebuilds the Merkle tree and checks
-- the leaves against the stored proof.
--
-- A "day" is a UTC date. Anchors for "today" are written at 00:05 UTC
-- the following day so the window is closed.

CREATE TABLE IF NOT EXISTS audit_anchor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Tenant scope (NULL means platform-level chain)
  org_id uuid REFERENCES organization(id),

  -- UTC date the anchor covers
  anchor_date date NOT NULL,

  -- External timestamp authority that signed this anchor
  provider varchar(32) NOT NULL CHECK (provider IN ('freetsa', 'opentimestamps')),

  -- Merkle root over all audit_log.entry_hash values for (org_id, anchor_date),
  -- sorted ASC by (created_at, id). 64 hex chars = 32 byte SHA-256.
  merkle_root varchar(64) NOT NULL,

  -- Number of audit_log rows this anchor covers. Used to spot a row-count
  -- mismatch quickly at verify time.
  leaf_count integer NOT NULL,

  -- The encoded proof from the provider. For FreeTSA: a .tsr file
  -- (ASN.1/DER, usually 2-3 KB). For OpenTimestamps: a .ots file
  -- (binary, initially ~400 B stub; grows to 1-2 KB once the Bitcoin
  -- attestation completes).
  proof bytea NOT NULL,

  -- Status of the proof. For FreeTSA this is always 'complete'. For
  -- OpenTimestamps, the initial stub is 'pending' — an upgrade job
  -- later replaces it with a 'complete' proof anchored to a Bitcoin
  -- block.
  proof_status varchar(16) NOT NULL DEFAULT 'complete'
    CHECK (proof_status IN ('pending', 'complete', 'failed')),

  -- For OpenTimestamps only: the Bitcoin block height that ultimately
  -- anchored this proof. NULL while the proof is still 'pending'.
  bitcoin_block_height bigint,

  -- For failed proofs — captures the upstream error so an operator can
  -- retry intelligently.
  last_error text,

  created_at timestamptz NOT NULL DEFAULT now(),
  upgraded_at timestamptz,
  verified_at timestamptz,

  -- A tenant gets at most one anchor per day per provider.
  UNIQUE (org_id, anchor_date, provider)
);

CREATE INDEX IF NOT EXISTS audit_anchor_org_date_idx
  ON audit_anchor (org_id, anchor_date DESC);

CREATE INDEX IF NOT EXISTS audit_anchor_pending_idx
  ON audit_anchor (provider, proof_status, created_at)
  WHERE proof_status = 'pending';

COMMENT ON TABLE audit_anchor IS
  'Daily external timestamp anchors of the per-tenant audit_log chain. ADR-011 rev.3. Supports FreeTSA (RFC 3161) and OpenTimestamps (Bitcoin). Each anchor covers one tenant, one UTC day, one provider.';

COMMENT ON COLUMN audit_anchor.proof IS
  'For FreeTSA: DER-encoded TimeStampResp (.tsr). For OpenTimestamps: binary .ots file. Store exactly as returned by the provider so offline verification stays possible even if our verification code evolves.';

COMMENT ON COLUMN audit_anchor.proof_status IS
  'pending = waiting for Bitcoin attestation (OpenTimestamps only); complete = verifiable end-to-end; failed = upstream rejected, see last_error and retry';

-- Register the audit trigger so changes to audit_anchor rows are themselves
-- auditable (anchor overwrites would be a red flag).
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON audit_anchor
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
