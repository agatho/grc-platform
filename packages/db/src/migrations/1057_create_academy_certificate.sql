-- Sprint 84: GRC Academy und Awareness
-- Migration 1057: Create academy_certificate table

CREATE TABLE IF NOT EXISTS academy_certificate (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  enrollment_id UUID NOT NULL REFERENCES academy_enrollment(id),
  user_id UUID NOT NULL REFERENCES "user"(id),
  course_id UUID NOT NULL REFERENCES academy_course(id),
  certificate_number VARCHAR(100) NOT NULL,
  pdf_url VARCHAR(2000),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  verification_hash VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX acrt_org_idx ON academy_certificate(org_id);
CREATE INDEX acrt_user_idx ON academy_certificate(user_id);
CREATE INDEX acrt_enrollment_idx ON academy_certificate(enrollment_id);
CREATE UNIQUE INDEX acrt_number_unique ON academy_certificate(certificate_number);

ALTER TABLE academy_certificate ENABLE ROW LEVEL SECURITY;
CREATE POLICY academy_certificate_org_isolation ON academy_certificate
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER academy_certificate_audit
  AFTER INSERT OR UPDATE OR DELETE ON academy_certificate
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
