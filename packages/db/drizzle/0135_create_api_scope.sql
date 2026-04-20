-- Sprint 57: API Scope Management
-- Migration 892: Create api_scope and api_key_scope tables

CREATE TABLE IF NOT EXISTS api_scope (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  module VARCHAR(50),
  read_write VARCHAR(10) NOT NULL DEFAULT 'read',
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX api_scope_module_idx ON api_scope(module);

CREATE TABLE IF NOT EXISTS api_key_scope (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES api_key(id) ON DELETE CASCADE,
  scope_id UUID NOT NULL REFERENCES api_scope(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX api_key_scope_unique_idx ON api_key_scope(api_key_id, scope_id);

-- Seed default scopes
INSERT INTO api_scope (key, name, module, read_write, is_system) VALUES
  ('erm:read', 'Risk Management - Read', 'erm', 'read', true),
  ('erm:write', 'Risk Management - Write', 'erm', 'write', true),
  ('bpm:read', 'Process Management - Read', 'bpm', 'read', true),
  ('bpm:write', 'Process Management - Write', 'bpm', 'write', true),
  ('ics:read', 'Internal Controls - Read', 'ics', 'read', true),
  ('ics:write', 'Internal Controls - Write', 'ics', 'write', true),
  ('isms:read', 'ISMS - Read', 'isms', 'read', true),
  ('isms:write', 'ISMS - Write', 'isms', 'write', true),
  ('bcms:read', 'BCMS - Read', 'bcms', 'read', true),
  ('bcms:write', 'BCMS - Write', 'bcms', 'write', true),
  ('dpms:read', 'Data Privacy - Read', 'dpms', 'read', true),
  ('dpms:write', 'Data Privacy - Write', 'dpms', 'write', true),
  ('audit:read', 'Audit - Read', 'audit', 'read', true),
  ('audit:write', 'Audit - Write', 'audit', 'write', true),
  ('tprm:read', 'Third Party Risk - Read', 'tprm', 'read', true),
  ('tprm:write', 'Third Party Risk - Write', 'tprm', 'write', true),
  ('platform:read', 'Platform - Read', NULL, 'read', true),
  ('platform:write', 'Platform - Write', NULL, 'write', true)
ON CONFLICT (key) DO NOTHING;
