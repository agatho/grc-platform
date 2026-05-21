-- Migration 0348: performance-index batch #1.
--
-- Adds 6 covering / partial / sort-friendly indexes that the post-Wave-25
-- DB performance audit (docs/audits/perf-db-index-audit-2026-05-22.md)
-- identified as load-bearing for hot routes.
--
-- All statements are idempotent (IF NOT EXISTS). The CONCURRENTLY keyword
-- is intentionally omitted because the platform's migrate-all runner wraps
-- each file in a transaction and CONCURRENTLY cannot run inside a
-- transaction; the indexes here are on tables small enough that a brief
-- lock during creation is acceptable (and the wave-23 migration policy
-- ADR-014 covers this trade-off).
--
-- Findings closed by this migration:
--
--   HIGH-1: risk(org_id, catalog_source, catalog_entry_id) — driven by
--   /api/v1/cross/risk-sync. Prior to this index, the per-draft "find
--   existing risk by catalog_source + catalog_entry_id" pre-check did a
--   table scan with an Index Cond on org_id only.
--
--   HIGH-5: vendor_due_diligence(org_id, status) — driven by
--   /api/v1/vendors, /api/v1/tprm/dashboard, dd-reminder cron. Table had
--   no org_id index at all (only vendor_id, status separately).
--
--   MEDIUM-1: security_incident(org_id, detected_at DESC) — incident
--   list view sorts by detected_at desc; without the index the planner
--   does a seq-scan on small data and a heap-scan-sort on growing.
--
--   MEDIUM-2: process_version(process_id) WHERE is_current = true —
--   getCurrentProcessVersion() hits this on every process page load.
--
--   MEDIUM-3: finding(org_id, created_at DESC) WHERE deleted_at IS NULL —
--   default findings list-page sort path.
--
--   MEDIUM-4: audit_evidence(audit_id) — audit-pack export joins evidence
--   on audit_id; large audits trip a nested-loop with seq-scan.

BEGIN;

CREATE INDEX IF NOT EXISTS risk_catalog_link_idx
  ON risk (org_id, catalog_source, catalog_entry_id)
  WHERE catalog_entry_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS vdd_org_status_idx
  ON vendor_due_diligence (org_id, status);

CREATE INDEX IF NOT EXISTS security_incident_org_detected_idx
  ON security_incident (org_id, detected_at DESC);

CREATE INDEX IF NOT EXISTS process_version_current_idx
  ON process_version (process_id)
  WHERE is_current = true;

CREATE INDEX IF NOT EXISTS finding_org_created_active_idx
  ON finding (org_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS audit_evidence_audit_idx
  ON audit_evidence (audit_id);

COMMIT;
