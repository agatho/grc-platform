-- Sprint 84: GRC Academy und Awareness
-- Migration 1056: Create academy_quiz_attempt table

CREATE TABLE IF NOT EXISTS academy_quiz_attempt (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  enrollment_id UUID NOT NULL REFERENCES academy_enrollment(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES academy_lesson(id),
  user_id UUID NOT NULL REFERENCES "user"(id),
  answers_json JSONB NOT NULL DEFAULT '[]',
  score_pct INT NOT NULL,
  passed BOOLEAN NOT NULL,
  attempt_number INT NOT NULL DEFAULT 1,
  duration_seconds INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX aqa_org_idx ON academy_quiz_attempt(org_id);
CREATE INDEX aqa_enrollment_idx ON academy_quiz_attempt(enrollment_id);
CREATE INDEX aqa_user_idx ON academy_quiz_attempt(user_id);

ALTER TABLE academy_quiz_attempt ENABLE ROW LEVEL SECURITY;
CREATE POLICY academy_quiz_attempt_org_isolation ON academy_quiz_attempt
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER academy_quiz_attempt_audit
  AFTER INSERT OR UPDATE OR DELETE ON academy_quiz_attempt
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
