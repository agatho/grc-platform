-- Sprint 77: Embedded BI und Report Builder
-- Migration 1020: Create bi_shared_dashboard table

DO $$ BEGIN
  CREATE TYPE bi_share_access AS ENUM ('view', 'edit');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS bi_shared_dashboard (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  report_id UUID NOT NULL REFERENCES bi_report(id) ON DELETE CASCADE,
  share_token VARCHAR(128) NOT NULL,
  access_level bi_share_access NOT NULL DEFAULT 'view',
  password VARCHAR(256),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  view_count INT NOT NULL DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  created_by UUID REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX bi_sd_token_unique ON bi_shared_dashboard(share_token);
CREATE INDEX bi_sd_org_idx ON bi_shared_dashboard(org_id);
CREATE INDEX bi_sd_report_idx ON bi_shared_dashboard(report_id);

ALTER TABLE bi_shared_dashboard ENABLE ROW LEVEL SECURITY;
CREATE POLICY bi_shared_dashboard_org_isolation ON bi_shared_dashboard
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER bi_shared_dashboard_audit
  AFTER INSERT OR UPDATE OR DELETE ON bi_shared_dashboard
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
