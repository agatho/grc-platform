-- Migration 0319: fix CISO×ERM permission from 'write' to 'read'.
--
-- #WAVE13-RBAC-01: Wave-12 QA found POST /api/v1/risks returning 403 for
-- ciso@meridian.test, but the /admin/roles page showed CISO has `write`
-- on `erm`. The endpoint check is correct — risk creation is reserved for
-- 1st-line (process_owner, control_owner) + risk_manager. CISO is 2nd-line
-- in the Three-Lines-of-Defense model (ADR-007 rev.1, ISO 31000 oversight)
-- and shouldn't author risks directly.
--
-- The seed in 0096_additional_system_roles.sql already says so in the
-- role description ("ERM + BCMS Lesen") — but the role_permission row was
-- erroneously inserted with action='write'. This corrects the data to
-- match the description and the endpoint behaviour. No code change needed.
--
-- Idempotent: the WHERE filter on action='write' is a no-op once applied.

UPDATE role_permission rp
SET action = 'read'
FROM custom_role cr
WHERE rp.role_id = cr.id
  AND cr.system_role_key = 'ciso'
  AND cr.is_system = true
  AND rp.module_key = 'erm'
  AND rp.action = 'write';
