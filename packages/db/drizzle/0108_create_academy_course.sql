-- Sprint 84: GRC Academy und Awareness
-- Migration 1053: Create academy_course table

DO $$ BEGIN
  CREATE TYPE academy_course_type AS ENUM ('gdpr', 'info_security', 'anti_corruption', 'nis2', 'dora', 'esg', 'phishing', 'code_of_conduct', 'aml', 'data_classification', 'incident_response', 'bcm', 'whistleblowing', 'it_security', 'custom');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS academy_course (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  course_type academy_course_type NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  thumbnail_url VARCHAR(2000),
  duration_minutes INT NOT NULL DEFAULT 30,
  passing_score_pct INT NOT NULL DEFAULT 80,
  is_mandatory BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  validity_days INT,
  target_roles JSONB NOT NULL DEFAULT '[]',
  target_departments JSONB NOT NULL DEFAULT '[]',
  content_json JSONB NOT NULL DEFAULT '{}',
  language VARCHAR(5) NOT NULL DEFAULT 'de',
  version INT NOT NULL DEFAULT 1,
  created_by UUID REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX academy_course_org_idx ON academy_course(org_id);
CREATE INDEX academy_course_type_idx ON academy_course(org_id, course_type);
CREATE INDEX academy_course_mandatory_idx ON academy_course(org_id, is_mandatory);

ALTER TABLE academy_course ENABLE ROW LEVEL SECURITY;
CREATE POLICY academy_course_org_isolation ON academy_course
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER academy_course_audit
  AFTER INSERT OR UPDATE OR DELETE ON academy_course
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
