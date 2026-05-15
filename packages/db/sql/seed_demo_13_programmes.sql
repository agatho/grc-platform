-- ============================================================================
-- ARCTOS Demo Seed: Programme Journeys (Wave-21-W22-B6)
-- ----------------------------------------------------------------------------
-- Wave-21 verification reported `GET /programmes` returned 0 items even
-- though the programme_template seeds existed. The /programmes endpoint
-- lists programme_journey instances (concrete per-org programmes), not
-- the abstract templates. Demo data needs at least 2 instances so the
-- endpoint, the maturity-breakdown route, and the UI all show data.
--
-- Two journeys per the Wave-21 spec:
--   1. ISO 27001 Zertifizierung 2026  (in execution phase)
--   2. DSGVO-Compliance-Roadmap        (in planning phase)
--
-- The org_id placeholder ccc4cc1c-... is replaced at runtime by
-- seed-all.ts's UUID-substitution pass.
-- ============================================================================

-- BEGIN; (commented for seed-all.ts row-error tolerance)

-- ── Programme 1: ISO 27001 Zertifizierung 2026 ─────────────────────────────
INSERT INTO programme_journey (
  id, org_id, template_id, template_code, template_version, ms_type,
  name, description, status, progress_percent, started_at,
  target_completion_date, approval_status, metadata, created_by, updated_by
)
SELECT
  '7a000000-0000-0000-0000-000000000001'::uuid,
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7'::uuid,
  pt.id,
  pt.code,
  pt.version,
  'isms',
  'ISO 27001 Zertifizierung 2026',
  'Aufbau und Zertifizierung des ISMS nach ISO/IEC 27001:2022. Stage-1-Audit Q3/2026, Stage-2-Audit Q4/2026.',
  -- programme_journey_status enum: planned | active | on_track | at_risk
  -- | blocked | completed | archived. (NOT 'in_progress' — that's a
  -- different enum, programme_step_status.) Use 'on_track' for an
  -- in-flight, healthy programme; 'at_risk' or 'blocked' if you want
  -- to seed a UI demo that shows warning states.
  'on_track',
  '42.50',
  '2026-01-15',
  '2026-12-15',
  'not_required',
  '{"sponsor": "CISO", "auditor": "TÜV Süd", "scope": "Hauptniederlassung + DE-Cloud"}'::jsonb,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'::uuid,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'::uuid
FROM programme_template pt
WHERE pt.code = 'iso27001-2022'
LIMIT 1
ON CONFLICT (org_id, name) DO NOTHING;

-- ── Programme 2: DSGVO-Compliance-Roadmap ──────────────────────────────────
INSERT INTO programme_journey (
  id, org_id, template_id, template_code, template_version, ms_type,
  name, description, status, progress_percent, started_at,
  target_completion_date, approval_status, metadata, created_by, updated_by
)
SELECT
  '7a000000-0000-0000-0000-000000000002'::uuid,
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7'::uuid,
  pt.id,
  pt.code,
  pt.version,
  'dpms',
  'DSGVO-Compliance-Roadmap 2026',
  'Strukturierter Aufbau der DSGVO-Compliance-Programme: RoPA-Vollerfassung, DPIA-Backlog, Auftragsverarbeiter-Audits.',
  'planned',
  '15.00',
  '2026-03-01',
  '2026-09-30',
  'not_required',
  '{"sponsor": "DPO", "scope": "Konzernweit", "phase": "planning"}'::jsonb,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'::uuid,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'::uuid
FROM programme_template pt
WHERE pt.code = 'gdpr-2016-679'
LIMIT 1
ON CONFLICT (org_id, name) DO NOTHING;

-- COMMIT;
