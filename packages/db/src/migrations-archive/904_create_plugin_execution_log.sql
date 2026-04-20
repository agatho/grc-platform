-- Sprint 58: Plugin Execution Logging
-- Migration 904: Create plugin_execution_log table

CREATE TABLE IF NOT EXISTS plugin_execution_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  installation_id UUID NOT NULL REFERENCES plugin_installation(id),
  hook_key VARCHAR(150) NOT NULL,
  status VARCHAR(20) NOT NULL,
  duration_ms INT,
  input_payload JSONB DEFAULT '{}',
  output_payload JSONB DEFAULT '{}',
  error_message TEXT,
  memory_used_bytes INT,
  cpu_time_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX plugin_exec_org_idx ON plugin_execution_log(org_id);
CREATE INDEX plugin_exec_install_idx ON plugin_execution_log(installation_id);
CREATE INDEX plugin_exec_created_idx ON plugin_execution_log(created_at);
CREATE INDEX plugin_exec_hook_idx ON plugin_execution_log(hook_key);

-- RLS
ALTER TABLE plugin_execution_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY plugin_execution_log_org_isolation ON plugin_execution_log
  USING (org_id::text = current_setting('app.current_org_id', true));
