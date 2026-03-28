-- Sprint 59: Onboarding Wizard
-- Migration 911: Create onboarding_session and onboarding_step tables

CREATE TABLE IF NOT EXISTS onboarding_session (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  status VARCHAR(20) NOT NULL DEFAULT 'in_progress',
  current_step INT NOT NULL DEFAULT 1,
  total_steps INT NOT NULL DEFAULT 8,
  selected_frameworks JSONB DEFAULT '[]',
  selected_modules JSONB DEFAULT '[]',
  org_profile JSONB DEFAULT '{}',
  completed_at TIMESTAMPTZ,
  skipped_at TIMESTAMPTZ,
  started_by UUID NOT NULL REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX onboarding_org_idx ON onboarding_session(org_id);
CREATE INDEX onboarding_status_idx ON onboarding_session(org_id, status);

-- RLS
ALTER TABLE onboarding_session ENABLE ROW LEVEL SECURITY;
CREATE POLICY onboarding_session_org_isolation ON onboarding_session
  USING (org_id::text = current_setting('app.current_org_id', true));

CREATE TABLE IF NOT EXISTS onboarding_step (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES onboarding_session(id) ON DELETE CASCADE,
  step_number INT NOT NULL,
  step_key VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  data JSONB DEFAULT '{}',
  completed_at TIMESTAMPTZ,
  skipped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX onboarding_step_unique_idx ON onboarding_step(session_id, step_number);
CREATE INDEX onboarding_step_key_idx ON onboarding_step(step_key);

-- Audit triggers
CREATE TRIGGER onboarding_session_audit AFTER INSERT OR UPDATE OR DELETE ON onboarding_session
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
