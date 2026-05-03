-- ============================================================================
-- Programme Cockpit — Cost-Tracking + Approval-Workflow
-- ============================================================================

-- ── Cost + Effort auf Steps und Subtasks ──────────────────────────────────

ALTER TABLE programme_journey_step
  ADD COLUMN IF NOT EXISTS cost_estimate numeric(14,2),
  ADD COLUMN IF NOT EXISTS cost_actual numeric(14,2),
  ADD COLUMN IF NOT EXISTS cost_currency varchar(3) NOT NULL DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS effort_hours integer,
  ADD COLUMN IF NOT EXISTS budget_id uuid REFERENCES grc_budget(id);

ALTER TABLE programme_journey_subtask
  ADD COLUMN IF NOT EXISTS cost_estimate numeric(14,2),
  ADD COLUMN IF NOT EXISTS cost_actual numeric(14,2),
  ADD COLUMN IF NOT EXISTS cost_currency varchar(3) NOT NULL DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS effort_hours integer;

-- ── Approval-Status auf Step + Journey ────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE programme_approval_status AS ENUM (
    'not_required',
    'pending',
    'approved',
    'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE programme_journey_step
  ADD COLUMN IF NOT EXISTS approval_status programme_approval_status
    NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS approval_required_for_status varchar(30),
  ADD COLUMN IF NOT EXISTS approver_id uuid REFERENCES "user"(id),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approval_notes text;

ALTER TABLE programme_journey
  ADD COLUMN IF NOT EXISTS approval_status programme_approval_status
    NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS approver_id uuid REFERENCES "user"(id),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approval_notes text;

-- ── Approval-Trail (append-only) ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS programme_approval_event (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organization(id),
  journey_id      uuid NOT NULL REFERENCES programme_journey(id) ON DELETE CASCADE,
  step_id         uuid REFERENCES programme_journey_step(id) ON DELETE CASCADE,
  action          varchar(50) NOT NULL,
  from_status     varchar(50),
  to_status       varchar(50),
  actor_id        uuid REFERENCES "user"(id),
  notes           text,
  occurred_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS programme_approval_event_journey_idx
  ON programme_approval_event(journey_id, occurred_at);
CREATE INDEX IF NOT EXISTS programme_approval_event_step_idx
  ON programme_approval_event(step_id);
CREATE INDEX IF NOT EXISTS programme_approval_event_org_idx
  ON programme_approval_event(org_id);

ALTER TABLE programme_approval_event ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_programme_approval_event ON programme_approval_event;
CREATE POLICY rls_programme_approval_event ON programme_approval_event
  USING (org_id::text = current_setting('app.current_org_id', true));

DROP TRIGGER IF EXISTS audit_programme_approval_event ON programme_approval_event;
CREATE TRIGGER audit_programme_approval_event
  AFTER INSERT OR UPDATE OR DELETE ON programme_approval_event
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- Append-only: blockt UPDATE/DELETE auf approval_event
CREATE OR REPLACE FUNCTION block_programme_approval_event_update()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'programme_approval_event is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS programme_approval_event_immutable ON programme_approval_event;
CREATE TRIGGER programme_approval_event_immutable
  BEFORE UPDATE OR DELETE ON programme_approval_event
  FOR EACH ROW EXECUTE FUNCTION block_programme_approval_event_update();
