-- Sprint 84: GRC Academy und Awareness
-- Migration 1054: Create academy_lesson table

DO $$ BEGIN
  CREATE TYPE academy_lesson_type AS ENUM ('video', 'text', 'interactive', 'quiz', 'simulation', 'document');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS academy_lesson (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  course_id UUID NOT NULL REFERENCES academy_course(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  lesson_type academy_lesson_type NOT NULL,
  content_json JSONB NOT NULL DEFAULT '{}',
  duration_minutes INT NOT NULL DEFAULT 10,
  sort_order INT NOT NULL DEFAULT 0,
  quiz_questions_json JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX academy_lesson_org_idx ON academy_lesson(org_id);
CREATE INDEX academy_lesson_course_idx ON academy_lesson(course_id);

ALTER TABLE academy_lesson ENABLE ROW LEVEL SECURITY;
CREATE POLICY academy_lesson_org_isolation ON academy_lesson
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER academy_lesson_audit
  AFTER INSERT OR UPDATE OR DELETE ON academy_lesson
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
