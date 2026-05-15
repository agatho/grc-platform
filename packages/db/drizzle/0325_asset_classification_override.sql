-- Migration 0325: asset_classification_override + override_status enum.
--
-- #WAVE21-MAR-P2-03: BIA → Asset-Criticality cascade lands in this PR
-- as a write-cascade (option A from the design call): on BIA finalize/
-- start, asset_classification rows are derived from
-- bia_process_impact.priorityRanking via process_asset linkage.
--
-- The override table sits in front of the cascade so operators can
-- correct edge cases the cascade gets wrong without losing the
-- audit-trail. Hybrid Light + Strict approval per the design call:
-- the row carries a `request_approval` boolean. If false, status =
-- 'active' on insert (Light path). If true, status = 'pending_approval'
-- and the BIA-derived value stays authoritative until an approver
-- clicks /approve (Strict path).
--
-- Idempotent: IF NOT EXISTS guards on the enum + table.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'asset_classification_override_status') THEN
    CREATE TYPE asset_classification_override_status AS ENUM (
      -- Light path: operator unchecked "Get Approval" → live immediately.
      'active',
      -- Strict path: operator checked "Get Approval" → BIA-derived
      -- value stays authoritative until approver clicks /approve.
      'pending_approval',
      -- Strict path completed: approver said yes. Same effect as 'active'
      -- but distinguishable in the audit log.
      'approved',
      -- Strict path completed: approver said no. The BIA-derived value
      -- continues to apply.
      'rejected',
      -- Operator-initiated revocation (e.g. they realised the override
      -- was wrong). Auditable removal vs. hard delete.
      'revoked'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS asset_classification_override (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES organization (id),
  asset_id            uuid NOT NULL REFERENCES asset (id) ON DELETE CASCADE,

  -- Which classification field is being overridden. Free text rather
  -- than enum so we don't need a migration every time the resolver
  -- learns about a new derived field. Validated server-side against a
  -- whitelist (confidentialityLevel | integrityLevel | availabilityLevel
  -- | overallProtection) — see the route in apps/web.
  field_name          varchar(80) NOT NULL,

  -- Snapshot of what the cascade computed at the moment the operator
  -- created the override. Frozen — even if the cascade later re-
  -- derives a different value, this row's derived_value stays as the
  -- "what you were correcting". The current cascade-value lives in
  -- asset_classification.
  derived_value       jsonb NOT NULL,
  override_value      jsonb NOT NULL,

  -- Audit-grade reason. The min-length check is duplicated in the Zod
  -- schema, here as a defence in depth so even a direct-DB write can't
  -- skip it.
  reason              text NOT NULL CHECK (length(reason) >= 20),

  -- Hybrid approval-flow flag, set at create time. Cannot change
  -- afterwards (operator rev a different override if they change their
  -- mind about needing approval).
  request_approval    boolean NOT NULL DEFAULT false,

  status              asset_classification_override_status NOT NULL,

  created_by          uuid NOT NULL REFERENCES "user" (id),
  created_at          timestamp with time zone NOT NULL DEFAULT now(),

  -- Strict-path approval audit (NULL on Light path or while pending).
  approved_by         uuid REFERENCES "user" (id),
  approved_at         timestamp with time zone,
  approval_notes      text,

  revoked_by          uuid REFERENCES "user" (id),
  revoked_at          timestamp with time zone,
  revocation_reason   text
);

CREATE INDEX IF NOT EXISTS aco_org_idx ON asset_classification_override (org_id);
CREATE INDEX IF NOT EXISTS aco_asset_idx ON asset_classification_override (asset_id);
CREATE INDEX IF NOT EXISTS aco_status_idx ON asset_classification_override (org_id, status);

-- Partial unique index: at most one ACTIVE/APPROVED override per
-- (asset, field). Pending and revoked rows can coexist with active
-- ones (operator can request a second approval-gated override while
-- the first is still pending).
CREATE UNIQUE INDEX IF NOT EXISTS aco_one_active_per_field_uniq
  ON asset_classification_override (asset_id, field_name)
  WHERE status IN ('active', 'approved');

-- Enable RLS so the per-org isolation matches the rest of the schema.
ALTER TABLE asset_classification_override ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'asset_classification_override'
      AND policyname = 'aco_tenant_select'
  ) THEN
    CREATE POLICY aco_tenant_select ON asset_classification_override
      FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'asset_classification_override'
      AND policyname = 'aco_tenant_insert'
  ) THEN
    CREATE POLICY aco_tenant_insert ON asset_classification_override
      FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'asset_classification_override'
      AND policyname = 'aco_tenant_update'
  ) THEN
    CREATE POLICY aco_tenant_update ON asset_classification_override
      FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'asset_classification_override'
      AND policyname = 'aco_tenant_delete'
  ) THEN
    CREATE POLICY aco_tenant_delete ON asset_classification_override
      FOR DELETE USING (org_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;
