-- Sprint 84: GRC Academy und Awareness
-- Migration 1055: Create academy_enrollment table

DO $$ BEGIN
  CREATE TYPE academy_enrollment_status AS ENUM ('assigned', 'in_progress', 'completed', 'overdue', 'exempted');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS academy_enrollment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  user_id UUID NOT NULL REFERENCES "user"(id),
  course_id UUID NOT NULL REFERENCES academy_course(id),
  status academy_enrollment_status NOT NULL DEFAULT 'assigned',
  progress_pct INT NOT NULL DEFAULT 0,
  completed_lessons JSONB NOT NULL DEFAULT '[]',
  last_lesson_id UUID,
  assigned_by UUID REFERENCES "user"(id),
  due_date TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX academy_enrollment_org_idx ON academy_enrollment(org_id);
CREATE INDEX academy_enrollment_user_idx ON academy_enrollment(user_id);
CREATE INDEX academy_enrollment_course_idx ON academy_enrollment(course_id);
CREATE INDEX academy_enrollment_status_idx ON academy_enrollment(org_id, status);
CREATE UNIQUE INDEX ae_user_course ON academy_enrollment(user_id, course_id);

ALTER TABLE academy_enrollment ENABLE ROW LEVEL SECURITY;
CREATE POLICY academy_enrollment_org_isolation ON academy_enrollment
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER academy_enrollment_audit
  AFTER INSERT OR UPDATE OR DELETE ON academy_enrollment
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
