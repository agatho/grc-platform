-- Migration 0349a: B2 Release-Cycle — multi-stage approval chain.
--
-- process_approval_step: one row per step of the definable approval chain
-- of a process version (review → approval → acknowledgment list).
-- Acknowledgment steps double as "Kenntnisnahme" records after publish.
--
-- Note on numbering: the assigned 0340–0349 range was already occupied by
-- committed migrations; the "0349a" suffix keeps this file lexicographically
-- between 0349_* and 0350_* for the migrate-all runner.

BEGIN;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'process_approval_step_type') THEN
    CREATE TYPE process_approval_step_type AS ENUM ('review', 'approval', 'acknowledgment');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'process_approval_step_status') THEN
    CREATE TYPE process_approval_step_status AS ENUM ('pending', 'in_progress', 'completed', 'rejected', 'skipped');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS process_approval_step (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organization(id),
  process_id uuid NOT NULL REFERENCES process(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  step_order integer NOT NULL,
  step_type process_approval_step_type NOT NULL,
  assignee_user_id uuid REFERENCES "user"(id),
  assignee_role varchar(80),
  status process_approval_step_status NOT NULL DEFAULT 'pending',
  decision varchar(20),                 -- 'approve' | 'reject' | 'acknowledge'
  comment text,
  decided_at timestamptz,
  decided_by uuid REFERENCES "user"(id),
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

CREATE INDEX IF NOT EXISTS pas_org_idx ON process_approval_step(org_id);
CREATE INDEX IF NOT EXISTS pas_process_idx ON process_approval_step(process_id);
CREATE INDEX IF NOT EXISTS pas_process_version_idx ON process_approval_step(process_id, version_number);
CREATE INDEX IF NOT EXISTS pas_assignee_idx ON process_approval_step(assignee_user_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS pas_process_version_order_uniq
  ON process_approval_step(process_id, version_number, step_order);

-- RLS (pattern of 0334)
ALTER TABLE process_approval_step ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_approval_step FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process_approval_step' AND policyname='pas_tenant_select') THEN
    CREATE POLICY pas_tenant_select ON process_approval_step FOR SELECT
      USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process_approval_step' AND policyname='pas_tenant_insert') THEN
    CREATE POLICY pas_tenant_insert ON process_approval_step FOR INSERT
      WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process_approval_step' AND policyname='pas_tenant_update') THEN
    CREATE POLICY pas_tenant_update ON process_approval_step FOR UPDATE
      USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
      WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process_approval_step' AND policyname='pas_tenant_delete') THEN
    CREATE POLICY pas_tenant_delete ON process_approval_step FOR DELETE
      USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
END $$;

-- Audit trigger
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'audit_trigger') THEN
    DROP TRIGGER IF EXISTS process_approval_step_audit_trigger ON process_approval_step;
    CREATE TRIGGER process_approval_step_audit_trigger
      AFTER INSERT OR UPDATE OR DELETE ON process_approval_step
      FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
END $$;

COMMIT;
