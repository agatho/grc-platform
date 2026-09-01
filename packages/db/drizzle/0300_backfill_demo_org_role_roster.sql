-- [ARCTOS-FULL-2026-08-31 / WP1 · S09-07] In-place repariert.
-- Diese Migration ist gegen eine leere Datenbank nie erfolgreich gelaufen
-- (Audit-Finding S09-01) und gilt nach ADR-014 als nicht ausgeliefert; die
-- Änderung an der bestehenden Datei ist daher zulässig.
-- Änderung: Die 1 Seed-INSERTs auf user_organization_role setzen harte FK-Werte auf Demo-Org/Demo-User, die keine Migration erzeugt. Sie sind auf INSERT ... SELECT ... WHERE EXISTS umgestellt und damit zeilenweise ein No-Op statt eines Abbruchs (S09-07).
-- 0300: Backfill the demo-data org (ccc4cc1c) role roster on already-deployed
-- databases.
--
-- The seed_demo_00_platform.sql change in PR #86 added 8 missing
-- user_organization_role rows for org ccc4cc1c so the owner picker in
-- the risk wizard sees a full set of candidates (QA-008). The seed
-- itself only fires on a fresh `npm run db:seed` run; production tenants
-- created before that change keep the original 2-user roster.
--
-- This migration is idempotent (ON CONFLICT DO NOTHING) and safe to run
-- against both fresh and existing deployments. The same insert appears
-- in seed_demo_00_platform.sql for fresh installs.
--
-- Verified via QA-008 re-test on 2026-05-11.

INSERT INTO user_organization_role (user_id, org_id, role, line_of_defense)
SELECT v.user_id::uuid, v.org_id::uuid, v.role::user_role, v.lod::line_of_defense
FROM (VALUES
  ('d4e5f6a7-b8c9-0123-def0-456789abcdef', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'risk_manager', 'second'),
  ('e5f6a7b8-c9d0-1234-ef01-56789abcdef0', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'risk_manager', 'second'),
  ('f6a7b8c9-d0e1-2345-f012-6789abcdef01', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'process_owner', 'first'),
  ('a7b8c9d0-e1f2-3456-0123-789abcdef012', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'control_owner', 'first'),
  ('b8c9d0e1-f2a3-4567-1234-89abcdef0123', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'risk_manager', 'first'),
  ('c9d0e1f2-a3b4-5678-2345-9abcdef01234', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'auditor', 'third'),
  ('d0e1f2a3-b4c5-6789-3456-abcdef012345', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'dpo', 'second'),
  ('e1f2a3b4-c5d6-7890-4567-bcdef0123456', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'risk_manager', 'second')
) AS v(user_id, org_id, role, lod)
WHERE EXISTS (SELECT 1 FROM "user" u WHERE u.id = v.user_id::uuid)
  AND EXISTS (SELECT 1 FROM organization o WHERE o.id = v.org_id::uuid)
ON CONFLICT DO NOTHING;
