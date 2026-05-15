-- Migration 0326: seed login-capable RBAC test users for Arctis Textilservice GmbH.
--
-- #WAVE21-W22-B7: Wave-21 verification reported `ciso@arctistx.test → 401`
-- (user doesn't exist). The Wave-21 spec mandated a second org with its
-- own users for the cross-tenant RLS-probe test suite. The org itself
-- (7cf7aa82-...) was already seeded in seed_demo_00_platform.sql; this
-- migration adds 3 logins so cross-tenant attempts can run with real
-- session cookies instead of a synthesized JWT.
--
-- Default password: WaveQA-2026! (same hash as the Meridian users in
-- 0317 — both share the bcrypt $2b$10 stretch).
--
-- Org: Arctis Textilservice GmbH = 7cf7aa82-af08-48f5-80d0-eb46b6e37319
-- Role assignments: ciso, process_owner, contract_manager
--   (mirrors the Meridian RBAC matrix subset that's most useful for
--    the cross-tenant tests — CISO does the read, process_owner does
--    the write, contract_manager exercises the TPRM cross-cut).
--
-- Idempotent: ON CONFLICT DO NOTHING.

BEGIN;

INSERT INTO "user" (id, email, name, password_hash, email_verified, is_active, language)
VALUES
  ('a0000003-0000-0000-0000-000000000001', 'ciso@arctistx.test',           'Arctistx CISO',             '$2b$10$YObrulE0IAoL0zR1A3b3d..8oPuwIZtGKk6f/fxPOTkGHwt5IGLKy', now(), true, 'de'),
  ('a0000003-0000-0000-0000-000000000002', 'process-owner@arctistx.test',  'Arctistx Process Owner',    '$2b$10$YObrulE0IAoL0zR1A3b3d..8oPuwIZtGKk6f/fxPOTkGHwt5IGLKy', now(), true, 'de'),
  ('a0000003-0000-0000-0000-000000000003', 'vendor-mgr@arctistx.test',     'Arctistx Vendor Manager',   '$2b$10$YObrulE0IAoL0zR1A3b3d..8oPuwIZtGKk6f/fxPOTkGHwt5IGLKy', now(), true, 'de')
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_organization_role (user_id, org_id, role, line_of_defense)
VALUES
  ('a0000003-0000-0000-0000-000000000001', '7cf7aa82-af08-48f5-80d0-eb46b6e37319', 'ciso',             'second'),
  ('a0000003-0000-0000-0000-000000000002', '7cf7aa82-af08-48f5-80d0-eb46b6e37319', 'process_owner',    'first'),
  ('a0000003-0000-0000-0000-000000000003', '7cf7aa82-af08-48f5-80d0-eb46b6e37319', 'contract_manager', 'first')
ON CONFLICT DO NOTHING;

-- ── Minimal data for cross-tenant probes ────────────────────────────────
-- 3 risks + 1 control owned by Arctistx. Just enough so an Org-A-user's
-- attempt to read these by ID returns 404 (proving the RLS isolation
-- works against real rows, not just absence-of-rows).
INSERT INTO risk (
  id, org_id, title, description, risk_category, risk_source, status,
  inherent_likelihood, inherent_impact, risk_score_inherent,
  created_by, updated_by
) VALUES
  ('a0000003-1000-0000-0000-000000000001', '7cf7aa82-af08-48f5-80d0-eb46b6e37319',
   'Arctistx — Lieferanten-Konzentration Asien',
   'Hohes Konzentrationsrisiko bei zwei chinesischen Stoff-Zulieferern (>60% Volumen).',
   'strategic', 'erm', 'identified', 4, 4, 16,
   'a0000003-0000-0000-0000-000000000001', 'a0000003-0000-0000-0000-000000000001'),
  ('a0000003-1000-0000-0000-000000000002', '7cf7aa82-af08-48f5-80d0-eb46b6e37319',
   'Arctistx — Wäscherei-Maschinenausfall',
   'Single-Point-of-Failure im Hauptbetrieb Wuppertal — keine Redundanz für die zentrale Industriewaschstraße.',
   'operational', 'erm', 'assessed', 3, 5, 15,
   'a0000003-0000-0000-0000-000000000002', 'a0000003-0000-0000-0000-000000000002'),
  ('a0000003-1000-0000-0000-000000000003', '7cf7aa82-af08-48f5-80d0-eb46b6e37319',
   'Arctistx — Fluktuation operatives Personal',
   'Erhöhte Personalfluktuation in Schichtbetrieb — Auswirkungen auf SLA-Einhaltung.',
   'operational', 'erm', 'identified', 3, 3, 9,
   'a0000003-0000-0000-0000-000000000002', 'a0000003-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;

COMMIT;
