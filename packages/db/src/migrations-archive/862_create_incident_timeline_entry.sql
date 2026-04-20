-- Sprint 55, Migration 862: Ensure incident_timeline_entry has event type validation
-- Table already exists from Sprint 5a; this adds CHECK constraint on action_type if missing

-- Add CHECK constraint for standardized event types (additive, does not break existing data)
DO $$ BEGIN
  ALTER TABLE incident_timeline_entry
    ADD CONSTRAINT ite_action_type_check
    CHECK (action_type IN (
      'detected','reported','escalated','contained','mitigated','resolved','post_mortem','other'
    ));
EXCEPTION
  WHEN duplicate_object THEN null;
  WHEN check_violation THEN null;
END $$;

-- Ensure RLS is enabled (idempotent)
ALTER TABLE incident_timeline_entry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS incident_timeline_entry_org_isolation ON incident_timeline_entry;
CREATE POLICY incident_timeline_entry_org_isolation ON incident_timeline_entry
  USING (org_id = current_setting('app.current_org_id', true)::uuid);
