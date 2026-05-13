-- #WAVE11-P1-INCIDENT: record DSGVO Art. 33 supervisory-authority
-- notification per incident.
--
-- The 72h notification window starts at detectedAt and is materialised
-- in security_incident.data_breach_72h_deadline (existing column).
-- This migration adds the trio of columns the new
--   POST /api/v1/isms/incidents/[id]/notify-authority
-- route writes:
--
--   authority_notified_at: timestamptz when the operator declared the
--     notification was sent (operator-supplied, defaults to now()).
--   notified_authority: free-text name of the supervisory authority.
--   notification_reason: free-text explanation, mandatory per Art. 33(3).
--
-- All three are nullable (an incident exists before the notification
-- is sent — and many incidents never warrant notification).
-- A partial index on the timestamp gives fast retrieval of "what was
-- notified in this period?" for the annual reporting endpoint.

BEGIN;

ALTER TABLE security_incident
  ADD COLUMN IF NOT EXISTS authority_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS notified_authority varchar(255),
  ADD COLUMN IF NOT EXISTS notification_reason text;

CREATE INDEX IF NOT EXISTS si_authority_notified_idx
  ON security_incident (org_id, authority_notified_at)
  WHERE authority_notified_at IS NOT NULL;

COMMIT;
