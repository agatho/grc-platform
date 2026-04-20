-- Sprint 86: Community Edition und Open-Source Packaging
-- Migration 1064: Create community_contribution table

DO $$ BEGIN
  CREATE TYPE contribution_status AS ENUM ('submitted', 'under_review', 'accepted', 'rejected', 'merged');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE contribution_type AS ENUM ('plugin', 'framework', 'template', 'translation', 'documentation', 'bug_fix', 'feature', 'rfc');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS community_contribution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  contributor_id UUID NOT NULL REFERENCES "user"(id),
  contribution_type contribution_type NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  repository_url VARCHAR(2000),
  pr_url VARCHAR(2000),
  status contribution_status NOT NULL DEFAULT 'submitted',
  review_notes TEXT,
  reviewed_by UUID REFERENCES "user"(id),
  reviewed_at TIMESTAMPTZ,
  cla_signed_at TIMESTAMPTZ,
  metadata_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX cc_org_idx ON community_contribution(org_id);
CREATE INDEX cc_contributor_idx ON community_contribution(contributor_id);
CREATE INDEX cc_type_idx ON community_contribution(contribution_type);
CREATE INDEX cc_status_idx ON community_contribution(status);

ALTER TABLE community_contribution ENABLE ROW LEVEL SECURITY;
CREATE POLICY community_contribution_org_isolation ON community_contribution
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER community_contribution_audit
  AFTER INSERT OR UPDATE OR DELETE ON community_contribution
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
