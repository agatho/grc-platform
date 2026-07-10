-- Migration 0354: DMS Paket D2 — Automatische Dokumentenlenkung.
--
-- 1. document.last_reminder_sent_at for the staged (30/14/7/0 days)
--    document-review-reminder worker cron.
-- 2. document_approval_step — multi-stage review/approval workflow per
--    document (+version snapshot). All steps completed → document is
--    auto-approved; any rejection → back to draft.

BEGIN;

ALTER TABLE document ADD COLUMN IF NOT EXISTS last_reminder_sent_at timestamptz;

DO $$ BEGIN
  CREATE TYPE document_approval_step_type AS ENUM ('review', 'approval');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE document_approval_step_status AS ENUM ('pending', 'completed', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE document_approval_decision AS ENUM ('approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS document_approval_step (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organization(id),
  document_id uuid NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  version_id uuid REFERENCES document_version(id) ON DELETE SET NULL,
  step_order integer NOT NULL,
  step_type document_approval_step_type NOT NULL DEFAULT 'review',
  assignee_user_id uuid NOT NULL REFERENCES "user"(id),
  status document_approval_step_status NOT NULL DEFAULT 'pending',
  decision document_approval_decision,
  comment text,
  decided_at timestamptz,

  -- Cross-cutting mandatory fields
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

CREATE INDEX IF NOT EXISTS das_org_idx ON document_approval_step(org_id);
CREATE INDEX IF NOT EXISTS das_document_idx ON document_approval_step(document_id, step_order);
CREATE INDEX IF NOT EXISTS das_assignee_status_idx ON document_approval_step(assignee_user_id, status);

-- RLS
ALTER TABLE document_approval_step ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_approval_step FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='document_approval_step' AND policyname='document_approval_step_tenant_select') THEN
    CREATE POLICY document_approval_step_tenant_select ON document_approval_step FOR SELECT
      USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='document_approval_step' AND policyname='document_approval_step_tenant_insert') THEN
    CREATE POLICY document_approval_step_tenant_insert ON document_approval_step FOR INSERT
      WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='document_approval_step' AND policyname='document_approval_step_tenant_update') THEN
    CREATE POLICY document_approval_step_tenant_update ON document_approval_step FOR UPDATE
      USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
      WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='document_approval_step' AND policyname='document_approval_step_tenant_delete') THEN
    CREATE POLICY document_approval_step_tenant_delete ON document_approval_step FOR DELETE
      USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
END $$;

-- Audit trigger (guarded: function may not exist on a fresh dev DB yet)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'audit_trigger')
     AND NOT EXISTS (
       SELECT 1 FROM pg_trigger
       WHERE tgname = 'document_approval_step_audit_trigger'
         AND tgrelid = 'document_approval_step'::regclass
     ) THEN
    CREATE TRIGGER document_approval_step_audit_trigger
      AFTER INSERT OR UPDATE OR DELETE ON document_approval_step
      FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
END $$;

COMMIT;
