-- Sprint 83: External Stakeholder Portals
-- Migration 1049: Create portal_questionnaire_response table

DO $$ BEGIN
  CREATE TYPE portal_questionnaire_status AS ENUM ('not_started', 'in_progress', 'submitted', 'reviewed', 'accepted', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS portal_questionnaire_response (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  session_id UUID NOT NULL REFERENCES portal_session(id),
  questionnaire_id UUID NOT NULL,
  status portal_questionnaire_status NOT NULL DEFAULT 'not_started',
  answers_json JSONB NOT NULL DEFAULT '{}',
  progress_pct INT NOT NULL DEFAULT 0,
  submitted_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES "user"(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX pqr_org_idx ON portal_questionnaire_response(org_id);
CREATE INDEX pqr_session_idx ON portal_questionnaire_response(session_id);
CREATE INDEX pqr_status_idx ON portal_questionnaire_response(org_id, status);

ALTER TABLE portal_questionnaire_response ENABLE ROW LEVEL SECURITY;
CREATE POLICY portal_questionnaire_response_org_isolation ON portal_questionnaire_response
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER portal_questionnaire_response_audit
  AFTER INSERT OR UPDATE OR DELETE ON portal_questionnaire_response
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
