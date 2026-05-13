-- Migration 0322: CISO read on DPMS + ESG.
--
-- #WAVE14-RBAC-CISO-DPMS-ESG: Wave-13 cross-role tests showed
-- ciso@meridian.test getting 200 on /api/v1/dpms/* and /api/v1/esg/*
-- because those routes use `withAuth()` without a role gate (read-open
-- to any authenticated session). The Role-Matrix UI didn't list these
-- modules for CISO, so the displayed permissions were narrower than
-- reality — auditors looking at /admin/roles got a misleading picture.
--
-- The role-matrix page is sourced from custom_role + role_permission;
-- the cleanest fix is to surface CISO's actual access (read-only) by
-- inserting the rows. CISO has legitimate cross-domain oversight
-- responsibility for both privacy (DPMS) and sustainability (ESG)
-- per ISO/IEC 27018:2019 §6 and IDW PS 982 — read access matches.
--
-- Idempotent: ON CONFLICT (role_id, module_key) DO NOTHING (the same
-- target the 0096 seed uses).

INSERT INTO role_permission (role_id, module_key, action)
SELECT cr.id, m.key, m.action
FROM custom_role cr
CROSS JOIN (VALUES
  ('dpms', 'read'),
  ('esg',  'read')
) AS m(key, action)
WHERE cr.system_role_key = 'ciso' AND cr.is_system = true
ON CONFLICT (role_id, module_key) DO NOTHING;
