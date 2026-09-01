-- [ARCTOS-FULL-2026-08-31 / WP1 · S09-07] In-place repariert.
-- Diese Migration ist gegen eine leere Datenbank nie erfolgreich gelaufen
-- (Audit-Finding S09-01) und gilt nach ADR-014 als nicht ausgeliefert; die
-- Änderung an der bestehenden Datei ist daher zulässig.
-- Änderung: Die 1 Seed-INSERTs auf user_organization_role setzen harte FK-Werte auf Demo-Org/Demo-User, die keine Migration erzeugt. Sie sind auf INSERT ... SELECT ... WHERE EXISTS umgestellt und damit zeilenweise ein No-Op statt eines Abbruchs (S09-07).
-- Migration 0346: seed login-capable BCM / Security / External-Auditor
-- accounts for Meridian Holdings.
--
-- #WAVE24-E1: Wave-23 wrapped up the first 9 RBAC test accounts (0317).
-- Wave-24's user-journey verification needs three more: a BCM manager
-- (US-12), a security analyst (US-13), and an external auditor (US-15).
-- The user_role enum already includes 'bcm_manager', 'security_analyst',
-- and 'external_auditor' (platform.ts:52/55/57 — added in earlier waves).
-- This migration only seeds the user rows + their org-role mappings so
-- the alpha invite list is complete.
--
-- Default password (all three accounts): WaveQA-2026!
-- bcrypt hash (cost 10): $2b$10$YObrulE0IAoL0zR1A3b3d..8oPuwIZtGKk6f/fxPOTkGHwt5IGLKy
-- (Same hash as migration 0317 — keeps QA + onboarding docs consistent.)
--
-- Org: Meridian Holdings GmbH = ccc4cc1c-4b09-499c-8420-ebd8da655cd7
-- Line-of-Defense mapping per ADR-007 rev.1:
--   bcm_manager      → second (oversight)
--   security_analyst → first  (operational, SOC bench)
--   external_auditor → third  (independent assurance)
--
-- Idempotent: ON CONFLICT DO NOTHING on email + user_organization_role
-- composite key. Safe to re-run.

BEGIN;

INSERT INTO "user" (id, email, name, password_hash, email_verified, is_active, language)
VALUES
  ('a0000002-0000-0000-0000-000000000010', 'bcm@meridian.test',          'Meridian BCM Manager',      '$2b$10$YObrulE0IAoL0zR1A3b3d..8oPuwIZtGKk6f/fxPOTkGHwt5IGLKy', now(), true, 'de'),
  ('a0000002-0000-0000-0000-000000000011', 'security@meridian.test',     'Meridian Security Analyst', '$2b$10$YObrulE0IAoL0zR1A3b3d..8oPuwIZtGKk6f/fxPOTkGHwt5IGLKy', now(), true, 'de'),
  ('a0000002-0000-0000-0000-000000000012', 'ext-auditor@meridian.test',  'External Auditor',          '$2b$10$YObrulE0IAoL0zR1A3b3d..8oPuwIZtGKk6f/fxPOTkGHwt5IGLKy', now(), true, 'de')
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_organization_role (user_id, org_id, role, line_of_defense)
SELECT v.user_id::uuid, v.org_id::uuid, v.role::user_role, v.lod::line_of_defense
FROM (VALUES
  ('a0000002-0000-0000-0000-000000000010', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'bcm_manager',      'second'),
  ('a0000002-0000-0000-0000-000000000011', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'security_analyst', 'first'),
  ('a0000002-0000-0000-0000-000000000012', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'external_auditor', 'third')
) AS v(user_id, org_id, role, lod)
WHERE EXISTS (SELECT 1 FROM "user" u WHERE u.id = v.user_id::uuid)
  AND EXISTS (SELECT 1 FROM organization o WHERE o.id = v.org_id::uuid)
ON CONFLICT DO NOTHING;

COMMIT;
